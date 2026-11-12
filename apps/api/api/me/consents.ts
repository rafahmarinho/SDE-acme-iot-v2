/**
 * POST /api/me/consents — record a consent decision for the caller (T178/T604).
 *
 * Withdrawal comes through the API (not a direct table write) so it is audited in every organization
 * the user belongs to; processing gated on consent reads the `consents` table, so it stops immediately.
 * The write uses the caller's user-scoped client: RLS limits it to the caller's own row.
 */
import { consentInput } from '@acme-iot/shared';
import { audit } from '../../src/lib/audit';
import { HttpError, json, readJson, route } from '../../src/lib/http';

const handler = route(
  { methods: ['POST'], auth: 'user', maxBodyBytes: 1_024, rateLimit: { limit: 20, windowSec: 60 }, name: 'me.consents' },
  async (ctx) => {
    if (!ctx.user) throw new HttpError(401, 'unauthorized');
    const input = await readJson(ctx, consentInput);
    if (input.purpose === 'essential' && !input.granted) {
      // Essential processing is required to provide the service; withdrawing it means deleting the account.
      throw new HttpError(400, 'essential_consent_required');
    }

    const { error } = await ctx.db.from('consents').upsert(
      {
        user_id: ctx.user.id,
        purpose: input.purpose,
        granted: input.granted,
        policy_version: input.policyVersion,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,purpose' },
    );
    if (error) throw new HttpError(500, 'consent_not_saved');

    const { data: orgs } = await ctx.db.from('memberships').select('org_id').eq('user_id', ctx.user.id);
    const action = input.granted ? 'consent.granted' : 'consent.withdrawn';
    for (const m of orgs ?? []) {
      await audit(ctx, m.org_id as string, action, 'user', ctx.user.id, {
        purpose: input.purpose,
        policyVersion: input.policyVersion,
      });
    }

    return json({ data: { purpose: input.purpose, granted: input.granted } });
  },
);

export { handler as POST, handler as OPTIONS };
