---
name: t338-access-control-authn-authz
description: Central authentication and role-based authorization for users and simulated devices across organizations, buildings, rooms and devices.
---

# T338: Control access to resources through user authentication and authorization

**Category:** CODE_FIX
**SD Elements:** [T338](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T338/)
**Priority:** 7

**Spec Context:**
> "...cards de dispositivos e navegação por organização, prédio e sala." (...device cards and navigation by organization, building and room.)
> Source: specs/PRD.md, L21-23
> "Tenha perfis de proprietário, administrador, operador e visualizador." (Owner, admin, operator, viewer roles.)
> Source: specs/PRD.md, L39

**What the spec implies (naive approach):**
Authenticating users but letting any logged-in user read any organization's buildings and devices; simulated devices posting readings without identity.

**Secure Implementation Pattern:**
```ts
// packages/shared/src/permissions.ts
export const PERMISSIONS = {
  'device.read':      ['owner', 'admin', 'operator', 'viewer'],
  'device.control':   ['owner', 'admin', 'operator'],
  'device.register':  ['owner', 'admin'],
  'firmware.rollout': ['owner', 'admin'],
  'team.manage':      ['owner', 'admin'],
  'org.delete':       ['owner'],
  'simulation.reset': ['owner', 'admin'],
} as const satisfies Record<string, Role[]>;
```
```sql
create function public.has_role(p_org uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from memberships m
                where m.org_id = p_org and m.user_id = auth.uid() and m.role = any(p_roles));
$$;
```

**Implementation Guidance:**
- Subjects: users (Supabase Auth) and devices (per-device credential, T69) — both authenticated.
- Single permission matrix used by API middleware; RLS uses `has_role`.
- Deny by default; new routes require an explicit permission key.

**Success Criteria:**
- [x] Permission matrix covers every API route and table
- [x] Devices authenticate before posting readings/state
- [ ] Cross-organization access denied in tests

**Status:** Applied
**Applied in:** packages/shared/src/permissions.ts, apps/api/src/middleware/auth.ts, apps/api/src/middleware/systemAuth.ts (HMAC-signed device principals), apps/api/src/lib/http.ts.
