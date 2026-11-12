---
name: t20-unique-session-ids-reset-after-auth
description: Ensure sessions are unique, system-generated and rotated after login and privilege changes (Supabase Auth JWT + refresh tokens) to prevent session fixation.
---

# T20: Generate unique session IDs and reset old IDs after authentication

**Category:** CODE_FIX
**SD Elements:** [T20](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T20/)
**Priority:** 9

**Spec Context:**
> "Supabase para PostgreSQL, login por e-mail e senha..." (Supabase for PostgreSQL, email and password login...)
> Source: specs/PRD.md, L5-7
> "Tenha perfis de proprietário, administrador, operador e visualizador." (Owner, administrator, operator and viewer roles.)
> Source: specs/PRD.md, L39

**What the spec implies (naive approach):**
Building a custom session token in the Vercel API (e.g. accepting a client-supplied session id or reusing a token across logins), or caching the user's role inside a long-lived token so a role change is not reflected.

**Secure Implementation Pattern:**
```ts
// Only accept tokens issued by Supabase Auth; never mint or accept custom session ids.
export async function requireUser(req: VercelRequest) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) throw new HttpError(401);
  const { data, error } = await supabaseAdmin.auth.getUser(token); // server-verified
  if (error || !data.user) throw new HttpError(401);
  return data.user;
}

// When a member's role changes (team screen), force re-issue of tokens:
export async function changeMemberRole(orgId: string, userId: string, role: Role) {
  await db.updateMembershipRole(orgId, userId, role);
  await supabaseAdmin.auth.admin.signOut(userId, 'global'); // revoke refresh tokens
}
```

**Implementation Guidance:**
- Rely on Supabase Auth for session issuance; enable refresh token rotation and reuse detection.
- Keep JWT expiry short (e.g. 15–60 min); roles are read from `memberships` per request, not trusted from client state.
- Revoke sessions (global sign-out) after password change/reset and role changes.
- Do not put session tokens in URLs; Expo deep links for auth must use PKCE flow.

**Success Criteria:**
- [ ] No custom session ids are created or accepted by the API
- [ ] Refresh token rotation enabled in Supabase Auth settings
- [ ] Role change or password reset invalidates existing sessions
- [ ] Auth uses PKCE; tokens never appear in URLs/logs

**Status:** Pending
