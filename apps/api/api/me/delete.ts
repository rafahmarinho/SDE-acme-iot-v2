/**
 * POST /api/me/delete — delete the caller's account (T5660).
 *
 * - The client re-authenticates with the password immediately before calling this route.
 * - Sole owners are refused with 409 so no organization is left without an owner
 *   (also enforced in the database by the `guard_last_owner` trigger).
 * - All sessions are revoked globally before the auth user is deleted; profile, memberships and
 *   consents are removed with the user. Audit rows are append-only and keep only the user id.
 */
import { z } from 'zod';
import { audit, log } from '../../src/lib/audit';
import { HttpError, json, readJson, route } from '../../src/lib/http';
import { supabaseAdmin } from '../../src/lib/supabase';

const deleteInput = z.object({}).strict();

const handler = route(
  { methods: ['POST'], auth: 'user', maxBodyBytes: 64, rateLimit: { limit: 3, windowSec: 3600 }, name: 'me.delete' },
  async (ctx) => {
    if (!ctx.user) throw new HttpError(401, 'unauthorized');
    await readJson(ctx, deleteInput);
    const userId = ctx.user.id;

    const { data: memberships, error } = await ctx.db
      .from('memberships')
      .select('org_id, role')
      .eq('user_id', userId);
    if (error) throw new HttpError(500, 'lookup_failed');

    const admin = supabaseAdmin();
    for (const m of memberships ?? []) {
      if (m.role !== 'owner') continue;
      const { count, error: countError } = await admin
        .from('memberships')
        .select('user_id', { count: 'exact', head: true })
        .eq('org_id', m.org_id)
        .eq('role', 'owner')
        .neq('user_id', userId);
      if (countError) throw new HttpError(500, 'lookup_failed');
      if (!count) throw new HttpError(409, 'sole_owner');
    }

    for (const m of memberships ?? []) {
      await audit(ctx, m.org_id as string, 'account.deleted', 'user', userId);
    }

    // Revoke every session (refresh tokens) before deleting the identity.
    const { error: signOutError } = await admin.auth.admin.signOut(ctx.user.accessToken, 'global');
    if (signOutError) log('warn', 'account.delete.signout_failed', { requestId: ctx.requestId });

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw new HttpError(500, 'delete_failed');

    return json({ data: { deleted: true } });
  },
);

export { handler as POST, handler as OPTIONS };
