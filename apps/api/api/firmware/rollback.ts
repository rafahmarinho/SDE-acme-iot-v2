/**
 * POST /api/firmware/rollback — roll a device back to the version recorded before a rollout.
 * Owner/admin only; rollout must belong to the caller's org (RLS + explicit org match).
 */
import { z } from 'zod';
import { rolesFor, uuid } from '@acme-iot/shared';
import { HttpError, json, readJson, route } from '../../src/lib/http';
import { requireRole } from '../../src/middleware/auth';
import { audit } from '../../src/lib/audit';
import { sendToDevice } from '../../src/lib/deviceSimClient';

const rollbackInput = z.object({ orgId: uuid, rolloutId: uuid }).strict();

export const POST = route(
  { methods: ['POST'], auth: 'user', maxBodyBytes: 1_024, rateLimit: { limit: 20, windowSec: 600 } },
  async (ctx) => {
    const input = await readJson(ctx, rollbackInput);
    await requireRole(ctx, input.orgId, [...rolesFor('firmware.rollback')]);

    const { data: rollout } = await ctx.db
      .from('firmware_rollouts')
      .select('id, device_id, status')
      .eq('id', input.rolloutId)
      .eq('org_id', input.orgId)
      .maybeSingle();
    if (!rollout) throw new HttpError(404, 'not_found');
    if (rollout.status === 'rolled_back') throw new HttpError(409, 'already_rolled_back');

    let accepted = false;
    try {
      accepted = (await sendToDevice(rollout.device_id as string, { op: 'rollback', rolloutId: input.rolloutId })).accepted;
    } catch {
      accepted = false;
    }
    await audit(ctx, input.orgId, 'firmware.rollback_requested', 'firmware_rollout', input.rolloutId, { accepted });
    return json({ data: { rolloutId: input.rolloutId, accepted } }, accepted ? 200 : 202);
  },
);

export { POST as OPTIONS };
