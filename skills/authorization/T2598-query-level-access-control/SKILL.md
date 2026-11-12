---
name: t2598-query-level-access-control
description: Enforce permissions on database objects themselves (RLS policies, column grants, restricted RPC functions) in the Supabase PostgreSQL schema.
---

# T2598: Implement query-level access control

**Category:** CODE_FIX
**SD Elements:** [T2598](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T2598/)
**Priority:** 8

**Spec Context:**
> "Entregue o código completo, configuração do banco, dados iniciais..." (Deliver the full code, database configuration, seed data...)
> Source: specs/PRD.md, L55-57
> "As versões web e mobile devem compartilhar o mesmo projeto Supabase." (Web and mobile share the same Supabase project.)
> Source: specs/PRD.md, L47-49

**What the spec implies (naive approach):**
"Database configuration" = tables only; clients query PostgREST directly with full table access, all columns readable (including device credential hashes and member emails).

**Secure Implementation Pattern:**
```sql
-- supabase/migrations/0001_init.sql
alter table devices enable row level security;
revoke select on devices from authenticated;
grant select (id, org_id, room_id, name, type, desired_state, reported_state,
              battery, online, firmware_version) on devices to authenticated; -- no credential_hash
-- RPCs: grant execute only to roles that need them
revoke execute on function public.reset_demo_data() from public, authenticated;
grant execute on function public.reset_demo_data() to service_role;
-- events: append-only
create policy events_insert on events for insert with check (public.has_role(org_id, array['owner','admin','operator']));
-- no update/delete policies on events
```

**Implementation Guidance:**
- Document a matrix: role × table × operation × columns; implement as policies + column grants.
- Sensitive columns (credential hashes, integration secrets) only accessible via service role.
- Add pgTAP or SQL tests asserting denial for each role.

**Success Criteria:**
- [x] Every table: RLS enabled and policies per operation
- [x] Secret columns not selectable by `authenticated`
- [x] Privileged RPCs not executable by clients

**Status:** Applied
