/**
 * Device-side logic of the HTTP device simulator.
 * Firmware install path (T197): size -> pinned-key signature -> hash -> model -> anti-downgrade,
 * staged only after every check; any failure rolls back and is recorded as an event.
 */
import { supabaseAdmin } from '../lib/supabase';
import {
  isNewerVersion,
  MAX_FIRMWARE_BYTES,
  sha256Hex,
  verifySignedManifest,
  type SignedManifest,
} from '../lib/firmwareSigning';
import { featureConfig } from './config';
import { safeOutboundFetch } from './outbound';
import { notifyMembers } from '../lib/notify';

interface DeviceRow {
  id: string;
  org_id: string;
  type: string;
  name: string;
  firmware_version: string | null;
}

async function loadDevice(deviceId: string): Promise<DeviceRow | null> {
  const { data } = await supabaseAdmin()
    .from('devices')
    .select('id, org_id, type, name, firmware_version')
    .eq('id', deviceId)
    .maybeSingle();
  return (data as DeviceRow | null) ?? null;
}

async function recordEvent(orgId: string, deviceId: string, kind: string, payload: Record<string, unknown>) {
  await supabaseAdmin().from('events').insert({ org_id: orgId, device_id: deviceId, kind, payload, is_simulation: true });
}

async function setRollout(rolloutId: string, status: string, progress: number) {
  await supabaseAdmin()
    .from('firmware_rollouts')
    .update({ status, progress, updated_at: new Date().toISOString() })
    .eq('id', rolloutId);
}

/** Apply desired state as the simulated device and report it back. */
export async function applyCommand(deviceId: string, desired: Record<string, unknown>, desiredVersion: number) {
  const device = await loadDevice(deviceId);
  if (!device) return { accepted: false };
  const reported = { ...desired, appliedVersion: desiredVersion, reportedAt: new Date().toISOString() };
  await supabaseAdmin()
    .from('device_state')
    .update({ reported, updated_at: new Date().toISOString() })
    .eq('device_id', deviceId)
    .lte('desired_version', desiredVersion);
  await recordEvent(device.org_id, deviceId, 'device.state_reported', { desiredVersion });
  return { accepted: true, reported };
}

async function rollback(device: DeviceRow, rolloutId: string, reason: string, version: string) {
  await setRollout(rolloutId, 'rolled_back', 100);
  await recordEvent(device.org_id, device.id, 'firmware.rolled_back', { rolloutId, reason });
  await notifyMembers(device.org_id, ['owner', 'admin'], 'firmware.failed', { version, device: device.name }).catch(() => undefined);
}

export async function installFirmware(
  deviceId: string,
  rolloutId: string,
  manifest: SignedManifest,
  downloadUrl: string,
): Promise<{ accepted: boolean }> {
  const device = await loadDevice(deviceId);
  if (!device) return { accepted: false };

  try {
    await setRollout(rolloutId, 'downloading', 10);
    if (manifest.body.size <= 0 || manifest.body.size > MAX_FIRMWARE_BYTES) throw new Error('size out of range');

    // Pinned public key from provisioning config — never taken from the update itself.
    if (!verifySignedManifest(manifest, featureConfig().firmwarePublicKey)) throw new Error('bad signature');
    if (manifest.body.model !== device.type) throw new Error('model mismatch');
    if (device.firmware_version && !isNewerVersion(manifest.body.version, device.firmware_version)) {
      throw new Error('downgrade rejected');
    }

    // Download only from the storage host (signed URL), with size cap enforced while streaming.
    const res = await safeOutboundFetch(new URL(downloadUrl), {
      timeoutMs: 15_000,
      maxResponseBytes: MAX_FIRMWARE_BYTES,
    });
    if (res.status !== 200) throw new Error('download failed');
    const blob = Buffer.from(res.body);
    if (blob.length !== manifest.body.size) throw new Error('size mismatch');
    if (sha256Hex(blob) !== manifest.body.sha256) throw new Error('hash mismatch');

    await setRollout(rolloutId, 'installing', 70);
    await supabaseAdmin()
      .from('devices')
      .update({ firmware_version: manifest.body.version })
      .eq('id', deviceId);
    await setRollout(rolloutId, 'succeeded', 100);
    await recordEvent(device.org_id, deviceId, 'firmware.installed', { rolloutId, version: manifest.body.version });
    return { accepted: true };
  } catch (err) {
    await rollback(device, rolloutId, err instanceof Error ? err.message : 'verification failed', manifest.body.version);
    return { accepted: false };
  }
}

/** Explicit operator-requested rollback: restore previous_version recorded on the rollout. */
export async function rollbackFirmware(deviceId: string, rolloutId: string): Promise<{ accepted: boolean }> {
  const device = await loadDevice(deviceId);
  if (!device) return { accepted: false };
  const { data: rollout } = await supabaseAdmin()
    .from('firmware_rollouts')
    .select('previous_version, device_id')
    .eq('id', rolloutId)
    .maybeSingle();
  if (!rollout || rollout.device_id !== deviceId) return { accepted: false };
  await supabaseAdmin().from('devices').update({ firmware_version: rollout.previous_version }).eq('id', deviceId);
  await setRollout(rolloutId, 'rolled_back', 100);
  await recordEvent(device.org_id, deviceId, 'firmware.rolled_back', { rolloutId, reason: 'requested' });
  return { accepted: true };
}
