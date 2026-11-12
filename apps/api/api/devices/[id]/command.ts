/**
 * POST /api/devices/:id/command — thermostat setpoint or smart plug on/off.
 *
 * - object-level authorization: the device is loaded with the user-scoped client (RLS), then the
 *   caller's role in the device's org must allow `device.control`
 * - desired state is persisted first (desired vs reported, PRD) with optimistic versioning
 * - the command reaches the simulated device only through the signed, allow-listed client (T558, T1365)
 */
import { deviceCommand, rolesFor } from '@acme-iot/shared';
import { HttpError, json, readJson, route } from '../../../src/lib/http';
import { requireRole } from '../../../src/middleware/auth';
import { audit } from '../../../src/lib/audit';
import { supabaseAdmin } from '../../../src/lib/supabase';
import { sendToDevice } from '../../../src/lib/deviceSimClient';
import { uuidAfter } from '../../../src/services/request';

export const POST = route(
  { methods: ['POST'], auth: 'user', maxBodyBytes: 1_024, rateLimit: { limit: 30, windowSec: 60 } },
  async (ctx) => {
    const deviceId = uuidAfter(ctx.req, 'devices');
    const command = await readJson(ctx, deviceCommand);

    const { data: device } = await ctx.db.from('devices').select('id, org_id, type').eq('id', deviceId).maybeSingle();
    if (!device) throw new HttpError(404, 'not_found'); // other orgs' devices are invisible under RLS
    await requireRole(ctx, device.org_id as string, [...rolesFor('device.control')]);

    const compatible =
      (command.kind === 'setpoint' && device.type === 'thermostat') || (command.kind === 'plug' && device.type === 'smart_plug');
    if (!compatible) throw new HttpError(422, 'unsupported_command');

    const { data: state } = await ctx.db
      .from('device_state')
      .select('desired, desired_version')
      .eq('device_id', deviceId)
      .maybeSingle();
    const currentVersion = (state?.desired_version as number | undefined) ?? 0;
    const desired =
      command.kind === 'setpoint'
        ? { ...(state?.desired as Record<string, unknown> | undefined), setpointCelsius: command.celsius }
        : { ...(state?.desired as Record<string, unknown> | undefined), on: command.on };
    const nextVersion = currentVersion + 1;

    const { data: updated, error } = await ctx.db
      .from('device_state')
      .update({ desired, desired_version: nextVersion, updated_at: new Date().toISOString() })
      .eq('device_id', deviceId)
      .eq('desired_version', currentVersion) // optimistic concurrency
      .select('device_id');
    if (error) throw new HttpError(500, 'update_failed');
    if (!updated || updated.length === 0) throw new HttpError(409, 'state_changed');

    let delivered = false;
    try {
      const ack = await sendToDevice(deviceId, { op: 'command', desired, desiredVersion: nextVersion });
      delivered = ack.accepted;
    } catch {
      delivered = false; // device offline / simulator unreachable: desired state stays pending
    }

    await supabaseAdmin()
      .from('events')
      .insert({ org_id: device.org_id, device_id: deviceId, kind: 'device.command', payload: { kind: command.kind, delivered } });
    await audit(ctx, device.org_id as string, 'device.command', 'device', deviceId, { kind: command.kind, delivered });

    return json({ data: { deviceId, desiredVersion: nextVersion, delivered } }, delivered ? 200 : 202);
  },
);

export { POST as OPTIONS };
