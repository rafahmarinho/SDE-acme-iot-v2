/**
 * Replay protection for signed system requests (T558).
 *
 * Signature verification itself is done by route({ auth: 'device' }) via middleware/systemAuth.ts.
 * That scheme accepts a ±300 s timestamp window; this guard makes each signature single-use inside
 * the window, so a captured request (e.g. a plug "on" command) cannot be replayed.
 */
import { HttpError } from '../lib/errors';
import { supabaseAdmin } from '../lib/supabase';
import type { Ctx } from '../lib/http';

export async function assertSingleUse(ctx: Ctx): Promise<void> {
  const signature = (ctx.req.headers.get('x-signature') ?? '').toLowerCase();
  const { data: fresh, error } = await supabaseAdmin().rpc('consume_rate_limit', {
    p_key: `sig:${signature}`,
    p_limit: 1,
    p_window_seconds: 900,
  });
  if (error || fresh !== true) throw new HttpError(401, 'unauthenticated');
}

/** Require the authenticated system principal to be the API-side simulator identity. */
export function requireSimulatorPrincipal(ctx: Ctx): void {
  if (ctx.device?.principalId !== 'simulator') throw new HttpError(401, 'unauthenticated');
}

/** Require the authenticated system principal to be a device (uuid), returning its id. */
export function requireDevicePrincipal(ctx: Ctx): string {
  const id = ctx.device?.principalId;
  if (!id || id === 'simulator') throw new HttpError(401, 'unauthenticated');
  return id;
}
