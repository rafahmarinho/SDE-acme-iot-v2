---
name: t5660-secure-data-control-options-for-users
description: Give ACME IoT users secure in-app controls to review, export and delete their data - clear local caches/tokens, delete account server-side, with re-authentication and ownership transfer safeguards.
---

# T5660: Implement secure data control options for users (Android)

**Category:** CODE_FIX
**SD Elements:** [T5660](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T5660/)
**Priority:** 7

**Spec Context:**
> "Inclua login, recuperação de senha, perfil, configurações" (Include login, password recovery, profile, settings) — Source: specs/PRD.md, line 11
> "mostre os últimos dados como leitura offline" (show the latest data as offline read) — Source: specs/PRD.md, line 53
> "Inclua uma área para ... reiniciar os dados" (Include an area to ... reset the data) — Source: specs/PRD.md, lines 43-45

**What the spec implies (naive approach):**
"Reset data" only resets demo data; users have no way to delete their account or local cached data, and logout leaves
tokens and readings on the device.

**Secure Implementation Pattern:**
```typescript
// apps/mobile/app/(app)/settings.tsx - actions
async function clearLocalData() {
  await clearOfflineCache();                          // T148
  await SecureStore.deleteItemAsync('sb-session');
  await SecureStore.deleteItemAsync('acme.installId');
}
async function deleteAccount(password: string) {
  await supabase.auth.signInWithPassword({ email: user.email!, password }); // re-auth
  const res = await api.post('/api/me/delete');          // server: transfer/block if sole owner, delete profile, revoke sessions
  if (res.ok) { await clearLocalData(); router.replace('/login'); }
}
```
```typescript
// apps/api/api/me/delete.ts (server)
if (await ctx.db.isSoleOwnerOfAnyOrg(ctx.userId)) return res.status(409).json({ error: 'Transfer ownership first' });
await ctx.admin.auth.admin.deleteUser(ctx.userId); // cascades profiles/consents via FK
```

**Implementation Guidance:**
- Settings provides: view/export my data (JSON), clear local data, delete account, manage consents (T604).
- Require re-authentication for deletion; block deletion of sole org owners until ownership is transferred.
- Server-side deletion revokes sessions and removes/anonymizes personal data; events keep only pseudonymous actor IDs.
- Clear tokens, caches and secure-store items on device after deletion/logout.

**Success Criteria:**
- [x] Users can export, clear local and delete their data from Settings
- [ ] Deletion requires re-auth and revokes all sessions
- [x] No personal data remains on device after deletion

**Status:** Applied
