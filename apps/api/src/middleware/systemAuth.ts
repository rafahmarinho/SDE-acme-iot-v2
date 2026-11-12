/**
 * System-account authentication for the HTTP device simulator / integrations (T69, T70, T558).
 *
 * Requests from system principals are signed:
 *   X-Device-Id:  principal id (device uuid or "simulator")
 *   X-Timestamp:  unix seconds (±300 s skew accepted — replay window)
 *   X-Signature:  hex HMAC-SHA256(secret, `${METHOD}\n${PATH}\n${TIMESTAMP}\n${sha256(body)}`)
 *
 * The shared simulator secret is validated at startup (≥ 32 random bytes, env.ts). Failed attempts
 * are throttled per principal and per IP across instances; lockouts are audited.
 */
import { CRYPTO_POLICY } from '@acme-iot/shared';
import { env } from '../lib/env';
import { hmacSha256Hex, safeEqual, sha256Hex } from '../lib/crypto';
import { HttpError } from '../lib/errors';
import { assertSystemAuthNotLocked, recordSystemAuthFailure, resetSystemAuthFailures } from './rateLimit';

const PRINCIPAL = /^(simulator|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export async function authenticateSystem(req: Request, rawBody: string, ip: string): Promise<{ principalId: string }> {
  const principalId = req.headers.get('x-device-id') ?? '';
  const ts = req.headers.get('x-timestamp') ?? '';
  const signature = (req.headers.get('x-signature') ?? '').toLowerCase();
  if (!PRINCIPAL.test(principalId) || !/^\d{10}$/.test(ts) || !/^[0-9a-f]{64}$/.test(signature)) {
    throw new HttpError(401, 'unauthenticated');
  }

  await assertSystemAuthNotLocked(principalId, ip);

  const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
  const path = new URL(req.url).pathname;
  const expected = hmacSha256Hex(
    env.DEVICE_SIM_SHARED_SECRET,
    `${req.method.toUpperCase()}\n${path}\n${ts}\n${sha256Hex(rawBody)}`,
  );
  const ok = skew <= CRYPTO_POLICY.maxSkewSeconds && safeEqual(expected, signature);

  if (!ok) {
    const locked = await recordSystemAuthFailure(principalId, ip);
    throw new HttpError(locked ? 429 : 401, locked ? 'rate_limited' : 'unauthenticated');
  }
  await resetSystemAuthFailures(principalId);
  return { principalId };
}

/** Sign an outgoing system request with the same scheme (used by deviceSimClient). */
export function signSystemRequest(method: string, path: string, body: string): Record<string, string> {
  const ts = Math.floor(Date.now() / 1000).toString();
  return {
    'X-Device-Id': 'simulator',
    'X-Timestamp': ts,
    'X-Signature': hmacSha256Hex(env.DEVICE_SIM_SHARED_SECRET, `${method.toUpperCase()}\n${path}\n${ts}\n${sha256Hex(body)}`),
  };
}
