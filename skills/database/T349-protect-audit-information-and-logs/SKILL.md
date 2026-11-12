---
name: t349-protect-audit-information-and-logs
description: Make the events, automation history and firmware rollout logs append-only and org-scoped in Supabase so users (even admins) cannot modify or delete audit records; handle simulation reset without erasing audit trail.
---

# T349: Protect audit information and logs against unauthorized access

**Category:** CODE_FIX
**SD Elements:** [T349](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T349/)
**Priority:** 7

**Spec Context:**
> "Crie automações simples de condição e ação, com intervalo entre execuções, histórico e notificações."
> (Create simple condition/action automations with cooldown between runs, history and notifications.)
> Source: specs/PRD.md, lines 31-33
> "...consultar eventos e reiniciar os dados." (query events and reset the data) — lines 45

**What the spec implies (naive approach):**
An `events` table with full CRUD for authenticated users, and a "reset data" button that truncates
everything — letting any user edit or wipe the history of control actions.

**Secure Implementation Pattern:**
```sql
create table public.events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id),
  actor_id uuid references auth.users(id),
  kind text not null, payload jsonb not null default '{}',
  is_simulation boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
create policy events_read on public.events for select
  using (public.is_member(organization_id));
-- no insert/update/delete policies for clients: writes only via security definer functions / API
revoke update, delete on public.events from authenticated, anon;
create trigger events_immutable before update or delete on public.events
  for each row execute function public.raise_immutable();
```

**Implementation Guidance:**
- Insert events only from the API (service role) or `security definer` functions that set `actor_id = auth.uid()`.
- Simulation reset deletes simulation data but records a `simulation.reset` event; audit rows for real
  user actions (role changes, firmware rollouts) are retained.
- Restrict event viewing to org members; sensitive audit (role changes) to owner/admin.
- Never store tokens/passwords in event payloads.

**Success Criteria:**
- [x] Clients cannot update/delete events (RLS + trigger tested).
- [x] All control commands, automation runs, firmware actions and role changes emit events.
- [x] Reset preserves an audit record.

**Status:** Applied
