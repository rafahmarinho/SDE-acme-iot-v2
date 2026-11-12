---
name: t604-implement-consent-withdrawal-mechanism
description: Let ACME IoT users withdraw consent as easily as they gave it (Settings screen), stop related processing immediately, and propagate withdrawal to processors/integrations.
---

# T604: Implement a consent withdrawal mechanism

**Category:** CODE_FIX
**SD Elements:** [T604](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T604/)
**Priority:** 10

**Spec Context:**
> "Inclua login, recuperação de senha, perfil, configurações" (Include login, password recovery, profile, settings) — Source: specs/PRD.md, line 11
> "Crie telas de ... integrações e equipe" (Create ... integrations and team screens) — Source: specs/PRD.md, lines 23-25

**What the spec implies (naive approach):**
Consent is collected once; there is no way to revoke it, or revoking only hides a toggle while emails, occupancy
analytics and integration data sharing continue.

**Secure Implementation Pattern:**
```typescript
// apps/api/api/me/consents.ts
export default withAuth(async (req, res, ctx) => {
  const { purpose } = z.object({ purpose: z.enum(['occupancy_analytics', 'email_notifications']) }).parse(req.body);
  await ctx.db.from('consents').insert({ user_id: ctx.userId, purpose, policy_version: CURRENT_POLICY, granted: false });
  if (purpose === 'email_notifications') await ctx.db.from('notification_prefs').update({ email: false }).eq('user_id', ctx.userId);
  if (purpose === 'occupancy_analytics') await ctx.jobs.enqueue('purge-occupancy-analytics', { userId: ctx.userId });
  await ctx.integrations.notifyConsentWithdrawn(ctx.userId, purpose); // simulated processors
  await ctx.events.log('consent.withdrawn', { purpose });
  return res.status(204).end();
});
```

**Implementation Guidance:**
- Settings screen exposes one-tap withdrawal per purpose (same effort as granting).
- Withdrawal takes effect immediately for new processing; schedule deletion of data collected only under that consent.
- Notify integrations/processors (simulated) and log the event for audit (T349).
- Confirm withdrawal to the user; do not degrade unrelated core features.

**Success Criteria:**
- [x] Each consent purpose can be withdrawn from Settings
- [ ] Related processing stops immediately after withdrawal
- [ ] Withdrawal is recorded and propagated to integrations

**Status:** Applied
