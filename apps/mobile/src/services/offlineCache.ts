/**
 * Offline read cache (PRD: "mostre os últimos dados como leitura offline").
 * T148: only an allow-listed projection of readings/device state is cached — never tokens, emails,
 *       team members, integration settings or firmware URLs. Entries expire after 24 h and are keyed by org.
 * T5634/T2133: native cache lives in cacheDirectory (excluded from iCloud backups, protected by
 *       NSFileProtectionComplete). T1468: web cache is sealed in the encrypted vault.
 * T164/T5660: wiped on logout, session errors and "Clear local data".
 */
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { z } from 'zod';

import { webVault } from './webVault';

const TTL_MS = 24 * 60 * 60 * 1000;

export const CachedDevice = z
  .object({
    id: z.string().uuid(),
    name: z.string().max(120),
    type: z.enum(['thermostat', 'smart_plug', 'temperature_sensor', 'humidity_sensor', 'occupancy_sensor']),
    roomId: z.string().uuid().nullable(),
    online: z.boolean(),
    batteryPct: z.number().int().min(0).max(100).nullable(),
    desired: z.record(z.union([z.number(), z.boolean()])).nullable(),
    reported: z.record(z.union([z.number(), z.boolean()])).nullable(),
    lastValue: z.number().nullable(),
    lastMetric: z.string().max(40).nullable(),
    recordedAt: z.string().nullable(),
  })
  .strict();
export type CachedDevice = z.infer<typeof CachedDevice>;

const Envelope = z.object({ savedAt: z.number(), orgId: z.string().uuid(), devices: z.array(CachedDevice) });

const DIR = `${FileSystem.cacheDirectory ?? ''}acme-offline/`;
const fileFor = (orgId: string) => `${DIR}${orgId}.json`;
const webKey = (orgId: string) => `offline:${orgId}`;

/** Projects arbitrary rows onto the allow-list; unknown/extra fields are dropped. */
export function project(rows: unknown[]): CachedDevice[] {
  const out: CachedDevice[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const candidate = {
      id: r.id,
      name: r.name,
      type: r.type,
      roomId: r.room_id ?? null,
      online: r.online,
      batteryPct: r.battery_pct ?? null,
      desired: (r.desired as Record<string, number | boolean> | undefined) ?? null,
      reported: (r.reported as Record<string, number | boolean> | undefined) ?? null,
      lastValue: r.last_value ?? null,
      lastMetric: r.last_metric ?? null,
      recordedAt: r.recorded_at ?? null,
    };
    const parsed = CachedDevice.safeParse(candidate);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export async function saveSnapshot(orgId: string, rows: unknown[]): Promise<void> {
  const body = JSON.stringify({ savedAt: Date.now(), orgId, devices: project(rows) });
  if (Platform.OS === 'web') {
    await webVault.setItem(webKey(orgId), body);
    return;
  }
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => undefined);
  await FileSystem.writeAsStringAsync(fileFor(orgId), body);
}

export async function loadSnapshot(orgId: string): Promise<{ savedAt: number; devices: CachedDevice[] } | null> {
  let raw: string | null = null;
  if (Platform.OS === 'web') raw = await webVault.getItem(webKey(orgId));
  else if ((await FileSystem.getInfoAsync(fileFor(orgId))).exists) raw = await FileSystem.readAsStringAsync(fileFor(orgId));
  if (!raw) return null;
  try {
    const parsed = Envelope.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.orgId !== orgId || Date.now() - parsed.data.savedAt > TTL_MS) {
      await removeSnapshot(orgId);
      return null;
    }
    return { savedAt: parsed.data.savedAt, devices: parsed.data.devices };
  } catch {
    await removeSnapshot(orgId);
    return null;
  }
}

async function removeSnapshot(orgId: string) {
  if (Platform.OS === 'web') await webVault.removeItem(webKey(orgId));
  else await FileSystem.deleteAsync(fileFor(orgId), { idempotent: true });
}

/** Removes every cached snapshot (all orgs). */
export async function wipeOfflineCache(): Promise<void> {
  if (Platform.OS === 'web') return; // the whole vault is deleted by wipeBrowserStorage()
  await FileSystem.deleteAsync(DIR, { idempotent: true });
}
