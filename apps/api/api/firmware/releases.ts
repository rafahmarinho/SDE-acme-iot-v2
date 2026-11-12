/**
 * /api/firmware/releases
 * GET  — list releases of an org (manifest-safe columns only)
 * POST — upload + sign a release (owner/admin)
 *
 * T2486: signing happens only here, server side, with the Ed25519 key from Vercel env.
 * T585:  artifacts are scanned for secrets/PII/internal URLs/debug markers before signing; release
 *        notes stay admin-side and never enter the device manifest; artifacts go to a private bucket.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { COLUMNS, deviceType, rolesFor, toDto, uuid } from '@acme-iot/shared';
import { HttpError, json, readJson, route } from '../../src/lib/http';
import { requireRole } from '../../src/middleware/auth';
import { audit } from '../../src/lib/audit';
import { supabaseAdmin } from '../../src/lib/supabase';
import { buildSignedRelease, MAX_FIRMWARE_BYTES } from '../../src/lib/firmwareSigning';
import { parseQuery } from '../../src/services/request';

const FIRMWARE_BUCKET = 'firmware';

const uploadInput = z
  .object({
    orgId: uuid,
    deviceType,
    version: z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/),
    contentBase64: z.string().max(Math.ceil((MAX_FIRMWARE_BYTES * 4) / 3) + 4).regex(/^[A-Za-z0-9+/]+={0,2}$/),
    notes: z.string().max(2_000).optional(),
  })
  .strict();

export const GET = route({ methods: ['GET'], auth: 'user' }, async (ctx) => {
  const { orgId } = parseQuery(ctx.req, z.object({ orgId: uuid }).strict());
  await requireRole(ctx, orgId, [...rolesFor('firmware.read')]);
  const { data, error } = await ctx.db
    .from('firmware_releases')
    .select(COLUMNS.firmwareRelease)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new HttpError(500, 'query_failed');
  return json({ data: (data ?? []).map((r) => toDto('firmwareRelease', r as Record<string, unknown>)) });
});

export const POST = route(
  { methods: ['POST'], auth: 'user', maxBodyBytes: 3 * 1024 * 1024, rateLimit: { limit: 10, windowSec: 3600 } },
  async (ctx) => {
    const input = await readJson(ctx, uploadInput);
    await requireRole(ctx, input.orgId, [...rolesFor('firmware.upload')]);

    const blob = Buffer.from(input.contentBase64, 'base64');
    let manifest;
    try {
      manifest = buildSignedRelease(blob, input.deviceType, input.version); // size + secret gate + sign
    } catch (e) {
      await audit(ctx, input.orgId, 'firmware.release_rejected', 'firmware_release', null, {
        reason: e instanceof Error ? e.message : 'invalid',
      });
      throw new HttpError(422, 'release_rejected');
    }

    const releaseId = randomUUID();
    const storagePath = `${input.orgId}/${releaseId}.bin`;
    const admin = supabaseAdmin();
    const { error: uploadError } = await admin.storage
      .from(FIRMWARE_BUCKET)
      .upload(storagePath, blob, { contentType: 'application/octet-stream', upsert: false });
    if (uploadError) throw new HttpError(500, 'upload_failed');

    // Clients have no INSERT grant on firmware_releases (signature/storage_path are server-generated);
    // the service-role insert runs only after requireRole above and is explicitly org-scoped.
    const { data: row, error } = await admin
      .from('firmware_releases')
      .insert({
        id: releaseId,
        org_id: input.orgId,
        device_type: input.deviceType,
        version: input.version,
        storage_path: storagePath,
        sha256: manifest.body.sha256,
        signature: manifest.signature,
        key_id: manifest.body.keyId,
        created_by: ctx.user?.id,
        created_at: manifest.body.releasedAt, // part of the signed manifest
      })
      .select(COLUMNS.firmwareRelease)
      .single();
    if (error || !row) {
      await admin.storage.from(FIRMWARE_BUCKET).remove([storagePath]);
      throw new HttpError(error?.code === '23505' ? 409 : 500, 'release_failed');
    }

    await audit(ctx, input.orgId, 'firmware.release_created', 'firmware_release', releaseId, {
      version: input.version,
      deviceType: input.deviceType,
      hasNotes: Boolean(input.notes),
    });
    return json({ data: toDto('firmwareRelease', row as Record<string, unknown>) }, 201);
  },
);

/** CORS preflight for all methods of this resource (route() answers OPTIONS before auth). */
export const OPTIONS = route({ methods: ['GET', 'POST'], auth: 'none' }, async () => {
  throw new HttpError(405, 'method_not_allowed');
});
