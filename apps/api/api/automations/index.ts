/**
 * /api/automations — condition/action automations with cooldown, history and notifications (PRD).
 * GET   — list (any member)
 * POST  — create (owner/admin); every referenced device must belong to the same org
 * PATCH — enable/disable (owner/admin)
 *
 * Notifications use fixed template keys only (T1144); users never author template text.
 */
import { z } from 'zod';
import { automationInput, COLUMNS, rolesFor, toDto, uuid } from '@acme-iot/shared';
import { HttpError, json, readJson, route } from '../../src/lib/http';
import { requireRole } from '../../src/middleware/auth';
import { audit } from '../../src/lib/audit';
import { parseQuery } from '../../src/services/request';

export const GET = route({ methods: ['GET'], auth: 'user' }, async (ctx) => {
  const { orgId } = parseQuery(ctx.req, z.object({ orgId: uuid }).strict());
  await requireRole(ctx, orgId, [...rolesFor('automation.read')]);
  const { data, error } = await ctx.db
    .from('automations')
    .select(COLUMNS.automation)
    .eq('org_id', orgId)
    .order('name')
    .limit(200);
  if (error) throw new HttpError(500, 'query_failed');
  return json({ data: (data ?? []).map((r) => toDto('automation', r as Record<string, unknown>)) });
});

export const POST = route(
  { methods: ['POST'], auth: 'user', maxBodyBytes: 16_384, rateLimit: { limit: 30, windowSec: 600 } },
  async (ctx) => {
    const input = await readJson(ctx, automationInput);
    await requireRole(ctx, input.orgId, [...rolesFor('automation.manage')]);

    const deviceIds = [...new Set([...input.conditions.map((c) => c.deviceId), ...input.actions.map((a) => a.deviceId)])];
    const { data: owned } = await ctx.db.from('devices').select('id').eq('org_id', input.orgId).in('id', deviceIds);
    if ((owned ?? []).length !== deviceIds.length) throw new HttpError(422, 'unknown_device');

    const { data, error } = await ctx.db
      .from('automations')
      .insert({
        org_id: input.orgId,
        name: input.name,
        condition: { all: input.conditions },
        action: { actions: input.actions, notify: input.notify, template: 'automation.triggered' },
        cooldown_seconds: input.cooldownSeconds,
        enabled: input.enabled,
      })
      .select(COLUMNS.automation)
      .single();
    if (error || !data) throw new HttpError(500, 'create_failed');

    await audit(ctx, input.orgId, 'automation.created', 'automation', data.id as string, {});
    return json({ data: toDto('automation', data as Record<string, unknown>) }, 201);
  },
);

const toggleInput = z.object({ orgId: uuid, id: uuid, enabled: z.boolean() }).strict();

export const PATCH = route(
  { methods: ['PATCH'], auth: 'user', maxBodyBytes: 1_024, rateLimit: { limit: 60, windowSec: 600 } },
  async (ctx) => {
    const input = await readJson(ctx, toggleInput);
    await requireRole(ctx, input.orgId, [...rolesFor('automation.manage')]);
    const { data, error } = await ctx.db
      .from('automations')
      .update({ enabled: input.enabled })
      .eq('id', input.id)
      .eq('org_id', input.orgId)
      .select(COLUMNS.automation)
      .maybeSingle();
    if (error) throw new HttpError(500, 'update_failed');
    if (!data) throw new HttpError(404, 'not_found');
    await audit(ctx, input.orgId, input.enabled ? 'automation.enabled' : 'automation.disabled', 'automation', input.id, {});
    return json({ data: toDto('automation', data as Record<string, unknown>) });
  },
);

/** CORS preflight for all methods of this resource (route() answers OPTIONS before auth). */
export const OPTIONS = route({ methods: ['GET', 'POST', 'PATCH'], auth: 'none' }, async () => {
  throw new HttpError(405, 'method_not_allowed');
});
