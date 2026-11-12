/**
 * POST /api/devices/report — device -> API heartbeat / reported state / readings (T558, T573).
 *
 * route({ auth: 'device' }) verifies the system signature (middleware/systemAuth.ts, with lockout on
 * failures); the signature is then made single-use (replay guard). The signed principal must be a
 * device id of an already-claimed device — unsigned, stale, replayed or unknown-device reports are
 * rejected, so forged heartbeats cannot register or update devices.
 */
import { z } from 'zod';
import { HttpError, json, route } from '../../src/lib/http';
import { assertSingleUse, requireDevicePrincipal } from '../../src/services/replay';

const Report = z
  .object({
    reported: z
      .record(z.union([z.string().max(64), z.number().finite(), z.boolean()]))
      .refine((r) => Object.keys(r).length <= 20, 'too many fields')
      .optional(),
    battery: z.number().int().min(0).max(100).optional(),
    readings: z
      .array(
        z
          .object({
            metric: z.enum(['temperature', 'humidity', 'occupancy', 'power', 'battery']),
            value: z.number().finite().min(-50).max(10_000),
          })
          .strict(),
      )
      .max(20)
      .optional(),
  })
  .strict();

const handler = route(
  { methods: ['POST'], auth: 'device', maxBodyBytes: 8 * 1024, rateLimit: { limit: 120, windowSec: 60 } },
  async (ctx) => {
    const deviceId = requireDevicePrincipal(ctx);
    await assertSingleUse(ctx);

    let parsed: z.infer<typeof Report>;
    try {
      parsed = Report.parse(JSON.parse(ctx.bodyText));
    } catch {
      throw new HttpError(400, 'invalid_body');
    }

    // ctx.db is the service-role client for auth='device'; every query is scoped to the signed device.
    const { data: device } = await ctx.db.from('devices').select('id, org_id').eq('id', deviceId).maybeSingle();
    if (!device) throw new HttpError(401, 'unauthenticated');
    const now = new Date().toISOString();

    await ctx.db
      .from('devices')
      .update({ online: true, last_seen_at: now, ...(parsed.battery !== undefined ? { battery_pct: parsed.battery } : {}) })
      .eq('id', deviceId);
    if (parsed.reported) {
      await ctx.db.from('device_state').update({ reported: parsed.reported, updated_at: now }).eq('device_id', deviceId);
    }
    if (parsed.readings?.length) {
      await ctx.db.from('readings').insert(
        parsed.readings.map((r) => ({ org_id: device.org_id, device_id: deviceId, metric: r.metric, value: r.value, recorded_at: now })),
      );
    }
    return json({ data: { ok: true } });
  },
);

export { handler as POST, handler as OPTIONS };
