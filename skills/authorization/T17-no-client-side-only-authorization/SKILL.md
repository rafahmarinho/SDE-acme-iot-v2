---
name: t17-no-client-side-only-authorization
description: Role-adapted navigation in the Expo web/mobile app must be backed by server-side checks (Supabase RLS and Vercel API middleware).
---

# T17: Do not only rely on client-side authorization

**Category:** CODE_FIX
**SD Elements:** [T17](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T17/)
**Priority:** 8

**Spec Context:**
> "Adapte a navegação aos perfis de usuário." (Adapt navigation to user roles.)
> Source: specs/PRD.md, L13-15
> "Tenha perfis de proprietário, administrador, operador e visualizador." (Owner, administrator, operator and viewer roles.)
> Source: specs/PRD.md, L39

**What the spec implies (naive approach):**
Hiding the "Firmware", "Team" or "Reset data" screens for viewers in Expo Router and considering that sufficient; anyone can still call Supabase or the API directly with their token.

**Secure Implementation Pattern:**
```ts
// apps/api/src/middleware/auth.ts
export async function requireRole(req: VercelRequest, orgId: string, allowed: Role[]) {
  const user = await requireUser(req);
  const { data } = await supabaseAdmin.from('memberships')
    .select('role').eq('org_id', orgId).eq('user_id', user.id).single();
  if (!data || !allowed.includes(data.role)) throw new HttpError(403);
  return { user, role: data.role as Role };
}
// usage: POST /api/simulation/reset
await requireRole(req, orgId, ['owner', 'admin']);
```
```sql
-- Same rule in the database for direct Supabase access
create policy firmware_write on firmware_releases for insert
  with check (public.has_role(org_id, array['owner','admin']));
```

**Implementation Guidance:**
- `packages/shared/src/permissions.ts` drives UI only; every mutation re-checks role on the server.
- Every API route calls `requireRole`; every table has RLS policies matching the matrix.
- Write tests calling the API as `viewer` for admin-only routes expecting 403.

**Success Criteria:**
- [ ] Every API route enforces role server-side
- [ ] RLS policies mirror the permission matrix
- [ ] Viewer token gets 403/RLS denial on admin actions when calling directly

**Status:** Applied
**Applied in:** packages/shared/src/permissions.ts (matrix, deny-by-default `can`), apps/api/src/middleware/auth.ts (`requireRole`/`requirePermission`, server-side membership lookup), apps/api/src/lib/http.ts (auth required unless `auth: 'none'`). RLS mirror: Layer A; per-route usage: Layer C.
