/**
 * Simulation engine: scenarios, advancing time, automation evaluation, reset (PRD simulation area).
 * Called only after the route has verified the caller's role in `orgId`; every service-role query is
 * explicitly scoped to that org.
 */
import { randomInt } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabase';
import { notifyMembers } from '../lib/notify';
import { sendToDevice } from '../lib/deviceSimClient';

type Scenario = 'device-offline' | 'low-battery' | 'reconnect' | 'firmware-update';

interface SimDevice {
  id: string;
  name: string;
  type: string;
  room_id: string;
  battery_pct: number | null;
  online: boolean;
}

const METRIC_BY_TYPE: Record<string, { metric: string; min: number; max: number }> = {
  thermostat: { metric: 'temperature', min: 180, max: 260 }, // tenths of °C
  temperature_sensor: { metric: 'temperature', min: 160, max: 290 },
  humidity_sensor: { metric: 'humidity', min: 300, max: 700 },
  occupancy_sensor: { metric: 'occupancy', min: 0, max: 2 },
  smart_plug: { metric: 'power', min: 0, max: 18_000 },
};

async function orgDevices(db: SupabaseClient, orgId: string): Promise<SimDevice[]> {
  const { data } = await db
    .from('devices')
    .select('id, name, type, room_id, battery_pct, online')
    .eq('org_id', orgId)
    .limit(500);
  return (data ?? []) as SimDevice[];
}

async function event(db: SupabaseClient, orgId: string, deviceId: string | null, kind: string, payload: Record<string, unknown>) {
  await db.from('events').insert({ org_id: orgId, device_id: deviceId, kind, payload, is_simulation: true });
}

export async function runScenario(orgId: string, scenario: Scenario): Promise<{ affected: number }> {
  const db = supabaseAdmin();
  const devices = await orgDevices(db, orgId);
  if (devices.length === 0) return { affected: 0 };
  const target = devices[randomInt(devices.length)];

  switch (scenario) {
    case 'device-offline':
      await db.from('devices').update({ online: false }).eq('id', target.id).eq('org_id', orgId);
      await db.from('alerts').insert({ org_id: orgId, device_id: target.id, severity: 'warning', message: 'Device went offline' });
      await event(db, orgId, target.id, 'device.offline', {});
      await notifyMembers(orgId, ['owner', 'admin', 'operator'], 'device.offline', { device: target.name, room: 'its room' });
      return { affected: 1 };
    case 'low-battery':
      await db.from('devices').update({ battery_pct: 8 }).eq('id', target.id).eq('org_id', orgId);
      await db.from('alerts').insert({ org_id: orgId, device_id: target.id, severity: 'warning', message: 'Battery low (8%)' });
      await event(db, orgId, target.id, 'device.battery_low', { battery: 8 });
      await notifyMembers(orgId, ['owner', 'admin', 'operator'], 'battery.low', { device: target.name, value: 8 });
      return { affected: 1 };
    case 'reconnect': {
      const offline = devices.filter((d) => !d.online);
      if (offline.length) {
        await db.from('devices').update({ online: true, last_seen_at: new Date().toISOString() }).eq('org_id', orgId).eq('online', false);
      }
      await event(db, orgId, null, 'simulation.reconnect', { devices: offline.length });
      return { affected: offline.length };
    }
    case 'firmware-update':
      await event(db, orgId, null, 'simulation.firmware_hint', { message: 'Start a rollout from the Firmware screen' });
      return { affected: 0 };
  }
}

interface AutomationRow {
  id: string;
  name: string;
  condition: { all?: Array<{ deviceId: string; metric: string; operator: string; value: number }> };
  action: { actions?: Array<{ deviceId: string; command: { kind: string; celsius?: number; on?: boolean } }>; notify?: boolean };
  cooldown_seconds: number;
  last_run_at: string | null;
}

function compare(op: string, a: number, b: number): boolean {
  switch (op) {
    case 'gt': return a > b;
    case 'gte': return a >= b;
    case 'lt': return a < b;
    case 'lte': return a <= b;
    case 'eq': return a === b;
    default: return false;
  }
}

export async function advance(orgId: string, steps: number): Promise<{ readings: number; automationsRun: number }> {
  const db = supabaseAdmin();
  const devices = (await orgDevices(db, orgId)).filter((d) => d.online);
  const latest = new Map<string, { metric: string; value: number }>();
  let readings = 0;

  for (let s = 0; s < steps; s++) {
    const rows = devices.map((d) => {
      const spec = METRIC_BY_TYPE[d.type];
      const value = randomInt(spec.min, spec.max + 1) / (spec.metric === 'occupancy' || spec.metric === 'power' ? 1 : 10);
      latest.set(d.id, { metric: spec.metric, value });
      return { org_id: orgId, device_id: d.id, metric: spec.metric, value, recorded_at: new Date().toISOString() };
    });
    if (rows.length) {
      await db.from('readings').insert(rows);
      readings += rows.length;
    }
  }

  const { data: automations } = await db
    .from('automations')
    .select('id, name, condition, action, cooldown_seconds, last_run_at')
    .eq('org_id', orgId)
    .eq('enabled', true)
    .limit(200);

  let automationsRun = 0;
  const now = Date.now();
  for (const a of (automations ?? []) as AutomationRow[]) {
    if (a.last_run_at && now - new Date(a.last_run_at).getTime() < a.cooldown_seconds * 1000) continue; // cooldown
    const conditions = a.condition.all ?? [];
    const matched = conditions.length > 0 && conditions.every((c) => {
      const r = latest.get(c.deviceId);
      return r !== undefined && r.metric === c.metric && compare(c.operator, r.value, c.value);
    });
    if (!matched) continue;

    for (const act of a.action.actions ?? []) {
      const desired = act.command.kind === 'setpoint' ? { setpointCelsius: act.command.celsius } : { on: act.command.on };
      const { data: st } = await db.from('device_state').select('desired_version').eq('device_id', act.deviceId).eq('org_id', orgId).maybeSingle();
      const version = ((st?.desired_version as number | undefined) ?? 0) + 1;
      await db.from('device_state').update({ desired, desired_version: version }).eq('device_id', act.deviceId).eq('org_id', orgId);
      await sendToDevice(act.deviceId, { op: 'command', desired, desiredVersion: version }).catch(() => undefined);
    }

    await db.from('automations').update({ last_run_at: new Date().toISOString() }).eq('id', a.id).eq('org_id', orgId);
    await db.from('automation_runs').insert({ org_id: orgId, automation_id: a.id, status: 'succeeded', detail: { conditions: conditions.length } });
    await event(db, orgId, null, 'automation.triggered', { automationId: a.id });
    if (a.action.notify) {
      const first = conditions[0];
      const device = devices.find((d) => d.id === first.deviceId);
      await notifyMembers(orgId, ['owner', 'admin', 'operator'], 'automation.triggered', {
        automation: a.name,
        room: 'its room',
        metric: first.metric,
        device: device?.name ?? 'a device',
        value: latest.get(first.deviceId)?.value ?? '',
      });
    }
    automationsRun++;
  }
  return { readings, automationsRun };
}

/**
 * Reset simulated state via the database's reset_demo_data(): it re-checks owner/admin membership of
 * the actor, deletes only simulation data (is_simulation events, readings, alerts, runs) and writes
 * the audit record. Non-simulation history stays append-only.
 */
export async function reset(orgId: string, actorId: string): Promise<void> {
  const { error } = await supabaseAdmin().rpc('reset_demo_data', { p_org: orgId, p_actor: actorId });
  if (error) throw new Error('reset_failed');
}
