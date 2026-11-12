/**
 * /api/devices
 * GET  — list an organization's devices (RLS-scoped, paginated, explicit columns)
 * POST — claim/register a device with its QR/manual registration code (T573)
 *
 * Registration never trusts device-supplied identity or endpoints: the code is format-validated and
 * verified server-side by `claim_device` against a provisioning record (hash, unexpired, unclaimed).
 * The device's HTTP endpoint is derived from server config, never taken from the QR payload.
 */
import { COLUMNS, listQuery, registerDeviceInput, rolesFor, toDto } from '@acme-iot/shared';
import { HttpError, json, readJson, route } from '../../src/lib/http';
import { requireRole } from '../../src/middleware/auth';
import { audit } from '../../src/lib/audit';
import { decodeCursor, encodeCursor, escapeLike, parseQuery } from '../../src/services/request';

export const GET = route({ methods: ['GET'], auth: 'user', rateLimit: { limit: 120, windowSec: 60 } }, async (ctx) => {
  const q = parseQuery(ctx.req, listQuery);
  await requireRole(ctx, q.orgId, [...rolesFor('device.read')]);

  const offset = decodeCursor(q.cursor);
  let query = ctx.db
    .from('devices')
    .select(COLUMNS.device)
    .eq('org_id', q.orgId)
    .order(q.sort, { ascending: q.order === 'asc' })
    .range(offset, offset + q.limit); // one extra row to detect a next page
  if (q.type) query = query.eq('type', q.type);
  if (q.q) query = query.ilike('name', `%${escapeLike(q.q)}%`);

  const { data, error } = await query;
  if (error) throw new HttpError(500, 'query_failed');
  const rows = (data ?? []) as Record<string, unknown>[];
  const page = rows.slice(0, q.limit).map((r) => toDto('device', r));
  return json({ data: page, nextCursor: rows.length > q.limit ? encodeCursor(offset + q.limit) : null });
});

export const POST = route(
  // Tight limit: registration codes must not be brute-forceable.
  { methods: ['POST'], auth: 'user', maxBodyBytes: 2_048, rateLimit: { limit: 10, windowSec: 300 } },
  async (ctx) => {
    const input = await readJson(ctx, registerDeviceInput);
    await requireRole(ctx, input.orgId, [...rolesFor('device.register')]);

    const { data: deviceId, error } = await ctx.db.rpc('claim_device', {
      p_org: input.orgId,
      p_room: input.roomId,
      p_code: input.code,
      p_name: input.name,
    });
    if (error || typeof deviceId !== 'string') {
      // One generic answer for unknown, expired or already-claimed codes (no enumeration oracle).
      await audit(ctx, input.orgId, 'device.claim_failed', 'device', null, {});
      throw new HttpError(400, 'registration_failed');
    }

    await audit(ctx, input.orgId, 'device.claimed', 'device', deviceId, { roomId: input.roomId });
    const { data: device } = await ctx.db.from('devices').select(COLUMNS.device).eq('id', deviceId).maybeSingle();
    return json({ data: device ? toDto('device', device as Record<string, unknown>) : { id: deviceId } }, 201);
  },
);

/** CORS preflight for all methods of this resource (route() answers OPTIONS before auth). */
export const OPTIONS = route({ methods: ['GET', 'POST'], auth: 'none' }, async () => {
  throw new HttpError(405, 'method_not_allowed');
});
