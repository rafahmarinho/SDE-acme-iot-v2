/**
 * API -> simulated device client (PRD: HTTP-only simulation, no MQTT broker).
 * - endpoint derived from server config + validated device id; never from device/QR data (T573, T1365)
 * - every request signed with the system scheme from middleware/systemAuth.ts (T558); the receiver
 *   additionally enforces single-use signatures (services/replay.ts)
 * - goes through safeOutboundFetch: https, allow-list, no redirects, timeouts, size cap (T1365, T156)
 */
import { z } from 'zod';
import { featureConfig } from '../services/config';
import { safeOutboundFetch } from '../services/outbound';
import { signSystemRequest } from '../middleware/systemAuth';
import type { SignedManifest } from './firmwareSigning';

const SIM_PATH = '/api/sim/device';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SimCommand =
  | { op: 'command'; desired: Record<string, unknown>; desiredVersion: number }
  | { op: 'firmware'; rolloutId: string; manifest: SignedManifest; downloadUrl: string }
  | { op: 'rollback'; rolloutId: string };

const SimAck = z.object({ accepted: z.boolean(), reported: z.record(z.unknown()).optional() });
export type SimAckT = z.infer<typeof SimAck>;

/** Signed POST to a fixed simulator path on the configured simulator host. */
export async function signedSimPost(path: string, payload: unknown, maxResponseBytes = 16 * 1024) {
  const url = new URL(path, featureConfig().deviceSimBaseUrl);
  const body = JSON.stringify(payload);
  return safeOutboundFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...signSystemRequest('POST', url.pathname, body) },
    body,
    timeoutMs: 5_000,
    maxResponseBytes,
  });
}

export async function sendToDevice(deviceId: string, command: SimCommand): Promise<SimAckT> {
  if (!UUID_RE.test(deviceId)) throw new Error('invalid device id');
  const res = await signedSimPost(SIM_PATH, { deviceId, ...command });
  if (res.status !== 200) throw new Error(`simulator responded ${res.status}`);
  return SimAck.parse(res.json()); // validate response shape before using it
}
