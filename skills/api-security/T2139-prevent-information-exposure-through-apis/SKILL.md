---
name: t2139-prevent-information-exposure-through-apis
description: Return explicit, minimal DTOs from the Vercel API and Supabase selects (no select *), never device secrets, other orgs' data or internal error details; filter server-side by role.
---

# T2139: Prevent information exposure through APIs

**Category:** CODE_FIX
**SD Elements:** [T2139](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T2139/)
**Priority:** 7

**Spec Context:**
> "Tenha perfis de proprietário, administrador, operador e visualizador."
> (Have owner, administrator, operator and viewer profiles.)
> Source: specs/PRD.md, line 39
> "Adapte a navegação aos perfis de usuário." (Adapt navigation to user profiles) — lines 13-15

**What the spec implies (naive approach):**
"Adapting navigation" per role on the client while the API returns full rows (`select('*')`),
including device secrets, firmware signing metadata and team members' emails to viewers.

**Secure Implementation Pattern:**
```ts
// apps/api/api/devices/index.ts
const DEVICE_COLUMNS = 'id, name, type, room_id, online, battery_pct, desired_state, reported_state, firmware_version';

const { data, error } = await userClient          // user-scoped client => RLS applies
  .from('devices')
  .select(DEVICE_COLUMNS)
  .eq('organization_id', orgId)
  .range(offset, offset + limit - 1);

if (error) {
  log.error({ err: error, route: 'devices.list' });
  return res.status(500).json({ error: 'internal_error' }); // no DB details
}
return res.json({ items: data.map(toDeviceDto) });
```

**Implementation Guidance:**
- Define DTO mappers in `packages/shared`; never return raw DB rows.
- Exclude secrets (`device_secret_hash`, claim tokens) at the column level; revoke SELECT on them
  from `authenticated` role.
- Role-based field filtering on the server (e.g. emails of team members only for owner/admin).
- Generic error messages to clients; details only in server logs.
- Remove unused/debug endpoints before release (see T49).

**Success Criteria:**
- [x] No `select('*')` in API or client code.
- [ ] Viewer role responses contain no admin-only fields (tested).
- [x] Error responses never include stack traces or SQL errors.

**Status:** Applied
**Applied in:** packages/shared/src/dto.ts (COLUMNS allow-lists, `pick`/`toDto`), packages/shared/src/permissions.ts (`team.read_contact` owner/admin only), apps/api/src/lib/http.ts (generic error codes only), apps/api/eslint.config.js (select(*) banned).
