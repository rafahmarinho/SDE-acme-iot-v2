---
name: t378-authorize-every-data-object-request
description: Check object-level authorization (org ownership) for every device, room, automation, alert, event and firmware record access to prevent IDOR.
---

# T378: Authorize every request for data objects

**Category:** CODE_FIX
**SD Elements:** [T378](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T378/)
**Priority:** 8

**Spec Context:**
> "Crie telas de dashboard, prédios, salas, cadastro e detalhe de dispositivos, automações, alertas, eventos, firmware, integrações e equipe." (Create dashboard, buildings, rooms, device registration and detail, automations, alerts, events, firmware, integrations and team screens.)
> Source: specs/PRD.md, L23-25
> "Prepare dados de demonstração com duas organizações..." (Prepare demo data with two organizations...)
> Source: specs/PRD.md, L43

**What the spec implies (naive approach):**
`GET /api/devices/:id` loads the device by id and returns it after only checking that the caller is logged in; a user from Org A can read/control Org B's devices by changing the id.

**Secure Implementation Pattern:**
```sql
alter table devices enable row level security;
create policy devices_select on devices for select
  using (public.has_role(org_id, array['owner','admin','operator','viewer']));
create policy devices_update on devices for update
  using (public.has_role(org_id, array['owner','admin','operator']));
-- repeat for buildings, rooms, readings, automations, alerts, events, firmware_*
```
```ts
// API: always scope the query; never fetch by id alone with service role
const { data: device } = await supabaseForRequest(token)
  .from('devices').select('*').eq('id', id).maybeSingle(); // RLS filters other orgs
if (!device) throw new HttpError(404);
```

**Implementation Guidance:**
- Use UUIDs, but don't rely on unguessability.
- For service-role code paths, explicitly check `org_id` membership before acting.
- Realtime channels: rely on RLS-enabled Postgres Changes so subscribers only get their org's rows.
- Test with the two demo orgs: cross-org reads/updates must fail.

**Success Criteria:**
- [ ] RLS select/update/delete policies on every org-scoped table
- [ ] Cross-org object access returns 404/denied (automated test)
- [ ] Realtime does not leak other org events

**Status:** Pending
