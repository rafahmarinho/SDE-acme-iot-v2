/**
 * Audit logging (T2602, T349, T70, T1362).
 *
 * Writes to the append-only `audit_log` table through `public.log_audit_event` (security definer).
 * Metadata is allow-listed and redacted: no tokens, secrets, passwords or raw request bodies.
 * Failures to audit are logged but never leak to the client.
 */
import type { Ctx } from './http';
import { supabaseAdmin } from './supabase';

const SENSITIVE_KEY = /(pass(word)?|secret|token|authorization|cookie|key|signature|code)$/i;

export function redact(meta: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = '[redacted]';
    } else if (typeof v === 'string') {
      out[k] = v.length > 500 ? `${v.slice(0, 500)}…` : v;
    } else if (typeof v === 'number' || typeof v === 'boolean' || v === null) {
      out[k] = v;
    } else {
      out[k] = '[omitted]';
    }
  }
  return out;
}

export async function audit(
  ctx: Ctx,
  orgId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  meta: Record<string, unknown> = {},
): Promise<void> {
  const metadata = redact({
    ...meta,
    requestId: ctx.requestId,
    ip: ctx.ip,
    actor: ctx.user?.id ?? ctx.device?.principalId ?? 'anonymous',
  });
  // Service role so system events (device auth lockouts) can be recorded; the function itself
  // validates inputs and the table is append-only.
  const { error } = await supabaseAdmin().rpc('log_audit_event', {
    p_org: orgId,
    p_action: action,
    p_target_type: targetType,
    p_target_id: targetId,
    p_metadata: metadata,
  });
  if (error) {
    log('error', 'audit_write_failed', { requestId: ctx.requestId, action, code: error.code });
  }
}

/** Structured server log with redaction — never logs headers, bodies or env values (T248). */
export function log(level: 'info' | 'warn' | 'error', event: string, meta: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...redact(meta) });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}
