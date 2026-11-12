/**
 * /api/firmware/rollouts
 * GET  — rollout progress for an org
 * POST — start a rollout of a signed release to devices (owner/admin)
 *
 * Before anything is sent, the stored artifact is re-hashed and the stored signature is verified
 * against the reconstructed manifest (tamper detection at rest). Devices receive only the signed,
 * allow-listed manifest fields plus a short-lived signed download URL over HTTPS (T2486, T585).
 */
import { z } from 'zod';
import { COLUMNS, firmwareRolloutInput, rolesFor, toDto, uuid } from '@acme-iot/shared';
import { HttpError, json, readJson, route } from '../../src/lib/http';
import { requireRole } from '../../src/middleware/auth';
import { audit } from '../../src/lib/audit';
import { supabaseAdmin } from '../../src/lib/supabase';
import { sendToDevice } from '../../src/lib/deviceSimClient';
import {
  sha256Hex,
  verifySignedManifest,
  type DeviceModel,
  type SignedManifest,
} from '../../src/lib/firmwareSigning';
import { featureConfig } from '../../src/services/config';
import { parseQuery } from '../../src/services/request';

const SIGNED_URL_TTL_SECONDS = 300;

export const GET = route({ methods: ['GET'], auth: 'user' }, async (ctx) => {
  const { orgId } = parseQuery(ctx.req, z.object({ orgId: uuid }).strict());
  await requireRole(ctx, orgId, [...rolesFor('firmware.read')]);
  const { data, error } = await ctx.db
    .from('firmware_rollouts')
    .select(COLUMNS.firmwareRollout)
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw new HttpError(500, 'query_failed');
  return json({ data: (data ?? []).map((r) => toDto('firmwareRollout', r as Record<string, unknown>)) });
});

export const POST = route(
  { methods: ['POST'], auth: 'user', maxBodyBytes: 8_192, rateLimit: { limit: 10, windowSec: 600 } },
  async (ctx) => {
    const input = await readJson(ctx, firmwareRolloutInput);
    await requireRole(ctx, input.orgId, [...rolesFor('firmware.rollout')]);

    // storage_path is server-only (no client SELECT grant): read via service role after the role
    // check, explicitly scoped to the caller's org.
    const admin = supabaseAdmin();
    const { data: release } = await admin
      .from('firmware_releases')
      .select('id, org_id, device_type, version, storage_path, sha256, signature, key_id, created_at')
      .eq('id', input.releaseId)
      .eq('org_id', input.orgId)
      .maybeSingle();
    if (!release) throw new HttpError(404, 'not_found');

    const { data: file, error: dlError } = await admin.storage.from('firmware').download(release.storage_path as string);
    if (dlError || !file) throw new HttpError(500, 'artifact_unavailable');
    const blob = Buffer.from(await file.arrayBuffer());

    const manifest: SignedManifest = {
      body: {
        version: release.version as string,
        model: release.device_type as DeviceModel,
        size: blob.length,
        sha256: release.sha256 as string,
        releasedAt: new Date(release.created_at as string).toISOString(),
        keyId: release.key_id as string,
      },
      signature: release.signature as string,
    };
    if (sha256Hex(blob) !== manifest.body.sha256 || !verifySignedManifest(manifest, featureConfig().firmwarePublicKey)) {
      await audit(ctx, input.orgId, 'firmware.integrity_failure', 'firmware_release', input.releaseId, {});
      throw new HttpError(409, 'release_integrity_failure');
    }

    const { data: devices } = await ctx.db
      .from('devices')
      .select('id, type, firmware_version')
      .eq('org_id', input.orgId)
      .in('id', input.deviceIds);
    const targets = (devices ?? []).filter((d) => d.type === release.device_type);

    const results: Array<{ deviceId: string; rolloutId?: string; accepted: boolean }> = [];
    for (const d of targets) {
      // No client INSERT grant on firmware_rollouts: service role, org-scoped, after requireRole.
      const { data: rollout, error } = await admin
        .from('firmware_rollouts')
        .insert({
          org_id: input.orgId,
          release_id: input.releaseId,
          device_id: d.id,
          status: 'pending',
          progress: 0,
          previous_version: d.firmware_version,
        })
        .select('id')
        .single();
      if (error || !rollout) {
        results.push({ deviceId: d.id as string, accepted: false });
        continue;
      }
      const { data: signed } = await admin.storage
        .from('firmware')
        .createSignedUrl(release.storage_path as string, SIGNED_URL_TTL_SECONDS);
      let accepted = false;
      if (signed?.signedUrl) {
        try {
          const ack = await sendToDevice(d.id as string, {
            op: 'firmware',
            rolloutId: rollout.id as string,
            manifest,
            downloadUrl: signed.signedUrl,
          });
          accepted = ack.accepted;
        } catch {
          accepted = false;
        }
      }
      results.push({ deviceId: d.id as string, rolloutId: rollout.id as string, accepted });
    }

    await audit(ctx, input.orgId, 'firmware.rollout_started', 'firmware_release', input.releaseId, {
      requested: input.deviceIds.length,
      targeted: targets.length,
    });
    return json({ data: results }, 202);
  },
);

/** CORS preflight for all methods of this resource (route() answers OPTIONS before auth). */
export const OPTIONS = route({ methods: ['GET', 'POST'], auth: 'none' }, async () => {
  throw new HttpError(405, 'method_not_allowed');
});
