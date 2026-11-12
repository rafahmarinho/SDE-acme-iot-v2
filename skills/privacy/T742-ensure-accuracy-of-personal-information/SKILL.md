---
name: t742-ensure-accuracy-of-personal-information
description: Provide self-serve profile maintenance in ACME IoT with validated input, a single source of truth for user/team data in Supabase, and verified email changes.
---

# T742: Implement technical measures to ensure the accuracy of personal information

**Category:** CODE_FIX
**SD Elements:** [T742](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T742/)
**Priority:** 7

**Spec Context:**
> "Inclua login, recuperação de senha, perfil, configurações" (Include login, password recovery, profile, settings) — Source: specs/PRD.md, line 11
> "Crie telas de ... equipe" (Create ... team screens) — Source: specs/PRD.md, line 25
> "As versões web e mobile devem compartilhar o mesmo projeto Supabase." (Web and mobile share the same Supabase project.) — Source: specs/PRD.md, lines 47-49

**What the spec implies (naive approach):**
Admins edit team members' names/emails freely, copies of user data live in several tables (memberships, events,
integrations) and drift, and email changes apply without verification.

**Secure Implementation Pattern:**
```sql
-- Single source of truth: profiles keyed by auth user; other tables reference, not copy
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy self_update on profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create view team_members as select m.org_id, m.role, p.user_id, p.display_name from memberships m join profiles p using (user_id);
```
```typescript
// Email change goes through Supabase verification flow
await supabase.auth.updateUser({ email: newEmail }); // confirmation sent to new (and old) address
```

**Implementation Guidance:**
- Users maintain their own profile (Profile screen); admins manage only role/membership, not personal fields.
- Validate inputs (length, charset, email format) on client and server (T42/T536).
- Reference `profiles` via joins/views instead of copying names/emails into other tables.
- Email changes require confirmation; show "last updated" and allow correction requests.

**Success Criteria:**
- [ ] Users can view and correct their own personal data
- [ ] Personal data stored once and referenced elsewhere
- [ ] Email changes require verification

**Status:** Pending
