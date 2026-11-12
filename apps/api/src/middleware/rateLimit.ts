/**
 * Throttling shared across serverless instances (T1362, T70).
 *
 * Backed by Postgres (`public.consume_rate_limit`, execute granted to service_role only) so limits
 * hold across Vercel instances. Keys combine a route name with the user id (authenticated) or the
 * client IP (unauthenticated / claim endpoints).
 */
import { HttpError } from '../lib/errors';
import { log } from '../lib/audit';
import { supabaseAdmin } from '../lib/supabase';

/** Named limits used across routes — tune in one place. */
export const LIMITS = {
  default: { limit: 120, windowSec: 60 },
  deviceCommand: { limit: 30, windowSec: 60 },
  deviceClaim: { limit: 5, windowSec: 300 },
  automationWrite: { limit: 20, windowSec: 60 },
  simulationAdvance: { limit: 30, windowSec: 60 },
  simulationReset: { limit: 3, windowSec: 3_600 },
  firmwareWrite: { limit: 10, windowSec: 300 },
  systemAuthFailures: { limit: 5, windowSec: 900 },
} as const;

export class RateLimitError extends HttpError {
  constructor(public retryAfterSec: number) {
    super(429, 'rate_limited');
  }
}

/** Consume one unit for `key`; throws 429 (with Retry-After) when the window is exhausted. */
export async function consume(key: string, limit: number, windowSec: number): Promise<void> {
  const { data, error } = await supabaseAdmin().rpc('consume_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSec,
  });
  if (error) {
    // Fail closed: if the limiter is unavailable, refuse rather than allowing unlimited traffic.
    log('error', 'rate_limit_unavailable', { key: key.split(':')[0], code: error.code });
    throw new HttpError(503, 'temporarily_unavailable');
  }
  if (data === false) {
    log('warn', 'rate_limit_exceeded', { key: key.split(':')[0] });
    throw new RateLimitError(windowSec);
  }
}

/**
 * System-account (device simulator / integration) authentication throttling (T70).
 * Counts failures per principal and per IP in a shared window; when either exceeds the limit,
 * further attempts are refused (even with a valid signature) until the window expires.
 */
export async function assertSystemAuthNotLocked(principalId: string, ip: string): Promise<void> {
  const { limit, windowSec } = LIMITS.systemAuthFailures;
  const since = new Date(Date.now() - windowSec * 1000).toISOString();
  const { data, error } = await supabaseAdmin()
    .from('api_rate_limits')
    .select('key, count')
    .in('key', [`authfail:p:${principalId}`, `authfail:ip:${ip}`])
    .gte('window_start', since);
  if (error) throw new HttpError(503, 'temporarily_unavailable');
  const totals = new Map<string, number>();
  for (const row of data ?? []) totals.set(row.key as string, (totals.get(row.key as string) ?? 0) + Number(row.count));
  for (const total of totals.values()) {
    if (total >= limit) throw new RateLimitError(windowSec);
  }
}

export async function recordSystemAuthFailure(principalId: string, ip: string): Promise<boolean> {
  const { limit, windowSec } = LIMITS.systemAuthFailures;
  const results = await Promise.all(
    [`authfail:p:${principalId}`, `authfail:ip:${ip}`].map((key) =>
      supabaseAdmin().rpc('consume_rate_limit', { p_key: key, p_limit: limit, p_window_seconds: windowSec }),
    ),
  );
  const locked = results.some((r) => r.data === false);
  log('warn', locked ? 'system_auth_locked' : 'system_auth_failed', { principalId });
  return locked;
}

/** A successful system authentication resets the principal's failure counter. */
export async function resetSystemAuthFailures(principalId: string): Promise<void> {
  await supabaseAdmin().from('api_rate_limits').delete().eq('key', `authfail:p:${principalId}`);
}
