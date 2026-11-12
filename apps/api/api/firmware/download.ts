/**
 * GET /api/firmware/download?orgId=&releaseId= — short-lived signed download URL for a release (T50).
 *
 * Clients reference firmware only by release id (indirect reference). The storage path is server-only:
 * it is resolved with the service role after the caller's org role is verified, and the response
 * carries a signed URL valid for 60 s — never the path itself.
 */
import { z } from 'zod';
import { rolesFor, uuid } from '@acme-iot/shared';
import { HttpError, json, route } from '../../src/lib/http';
import { requireRole } from '../../src/middleware/auth';
import { audit } from '../../src/lib/audit';
import { supabaseAdmin } from '../../src/lib/supabase';
import { parseQuery } from '../../src/services/request';

const DOWNLOAD_TTL_SECONDS = 60;

export const GET = route({ methods: ['GET'], auth: 'user', rateLimit: { limit: 20, windowSec: 600 } }, async (ctx) => {
  const { orgId, releaseId } = parseQuery(ctx.req, z.object({ orgId: uuid, releaseId: uuid }).strict());
  await requireRole(ctx, orgId, [...rolesFor('firmware.upload')]); // artifacts are for owner/admin only

  const admin = supabaseAdmin();
  const { data: release } = await admin
    .from('firmware_releases')
    .select('id, storage_path')
    .eq('id', releaseId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!release) throw new HttpError(404, 'not_found');

  const { data: signed, error } = await admin.storage
    .from('firmware')
    .createSignedUrl(release.storage_path as string, DOWNLOAD_TTL_SECONDS);
  if (error || !signed?.signedUrl) throw new HttpError(500, 'download_unavailable');

  await audit(ctx, orgId, 'firmware.download_url_issued', 'firmware_release', releaseId, {});
  return json({ data: { url: signed.signedUrl, expiresInSeconds: DOWNLOAD_TTL_SECONDS } });
});

export { GET as OPTIONS };
