/**
 * /api/integrations — simulated external integrations (owner/admin).
 * GET  — list
 * POST — create from the fixed catalog (no URLs accepted), or `{ action: "test" }` to ping one
 *
 * Outbound traffic is HMAC-signed (T558) and goes through safeOutboundFetch (T1365, T156).
 */
import { z } from 'zod';
import { COLUMNS, rolesFor, toDto, uuid } from '@acme-iot/shared';
import { HttpError, json, readJson, route } from '../../src/lib/http';
import { requireRole } from '../../src/middleware/auth';
import { audit } from '../../src/lib/audit';
import { parseQuery } from '../../src/services/request';
import { CATALOG, endpointFor, INTEGRATION_KINDS, targetHostFor, type IntegrationKind } from '../../src/services/integrationCatalog';
import { signedSimPost } from '../../src/lib/deviceSimClient';

export const GET = route({ methods: ['GET'], auth: 'user' }, async (ctx) => {
  const { orgId } = parseQuery(ctx.req, z.object({ orgId: uuid }).strict());
  await requireRole(ctx, orgId, [...rolesFor('integration.read')]);
  const { data, error } = await ctx.db.from('integrations').select(COLUMNS.integration).eq('org_id', orgId).limit(100);
  if (error) throw new HttpError(500, 'query_failed');
  return json({
    data: (data ?? []).map((r) => toDto('integration', r as Record<string, unknown>)),
    catalog: INTEGRATION_KINDS.map((k) => ({ kind: k, label: CATALOG[k].label })),
  });
});

const body = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('create'),
      orgId: uuid,
      kind: z.enum(INTEGRATION_KINDS),
      name: z.string().trim().min(1).max(120),
      enabled: z.boolean().default(true),
    })
    .strict(),
  z.object({ action: z.literal('test'), orgId: uuid, integrationId: uuid }).strict(),
]);

const SimIntegrationResponse = z.object({ ok: z.boolean(), kind: z.enum(INTEGRATION_KINDS), sample: z.record(z.union([z.string(), z.number()])) });

export const POST = route(
  { methods: ['POST'], auth: 'user', maxBodyBytes: 2_048, rateLimit: { limit: 30, windowSec: 600 } },
  async (ctx) => {
    const input = await readJson(ctx, body);
    await requireRole(ctx, input.orgId, [...rolesFor('integration.manage')]);

    if (input.action === 'create') {
      const { data, error } = await ctx.db
        .from('integrations')
        .insert({ org_id: input.orgId, kind: input.kind, name: input.name, target_host: targetHostFor(input.kind), enabled: input.enabled })
        .select(COLUMNS.integration)
        .single();
      if (error || !data) throw new HttpError(500, 'create_failed');
      await audit(ctx, input.orgId, 'integration.created', 'integration', data.id as string, { kind: input.kind });
      return json({ data: toDto('integration', data as Record<string, unknown>) }, 201);
    }

    const { data: integration } = await ctx.db
      .from('integrations')
      .select('id, kind, enabled')
      .eq('id', input.integrationId)
      .eq('org_id', input.orgId)
      .maybeSingle();
    if (!integration) throw new HttpError(404, 'not_found');
    if (!integration.enabled) throw new HttpError(409, 'integration_disabled');

    const kind = integration.kind as IntegrationKind;
    if (!(INTEGRATION_KINDS as readonly string[]).includes(kind)) throw new HttpError(422, 'unknown_kind');
    // Endpoint comes from the fixed catalog + server config only (never from stored/user data).
    const res = await signedSimPost(endpointFor(kind).pathname, { kind }, 8_192).catch(() => null);

    const parsed = res && res.status === 200 ? SimIntegrationResponse.safeParse(res.json()) : null;
    const ok = Boolean(parsed?.success && parsed.data.ok);
    await audit(ctx, input.orgId, 'integration.tested', 'integration', input.integrationId, { ok });
    return json({ data: { ok, sample: parsed?.success ? parsed.data.sample : null } });
  },
);

/** CORS preflight for all methods of this resource (route() answers OPTIONS before auth). */
export const OPTIONS = route({ methods: ['GET', 'POST'], auth: 'none' }, async () => {
  throw new HttpError(405, 'method_not_allowed');
});
