---
name: t19-restrict-app-database-access
description: Limit database privileges - clients use anon/authenticated roles under RLS; the Supabase service role is server-only and used minimally.
---

# T19: Restrict Application's Access to Database

**Category:** CODE_FIX
**SD Elements:** [T19](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T19/)
**Priority:** 8

**Spec Context:**
> "...Supabase para PostgreSQL..." (Supabase for PostgreSQL)
> Source: specs/PRD.md, L5
> "As versões web e mobile devem compartilhar o mesmo projeto Supabase." (Web and mobile versions must share the same Supabase project.)
> Source: specs/PRD.md, L47-49

**What the spec implies (naive approach):**
Using the `service_role` key everywhere in the Vercel API (or worse, in the Expo app) for convenience, bypassing RLS and granting full DB access to any bug.

**Secure Implementation Pattern:**
```ts
// apps/api/src/lib/supabaseUser.ts — default: act AS the user, RLS applies
export function supabaseForRequest(accessToken: string) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}
// supabaseAdmin (service role) only in: simulation tick, firmware rollout worker, seed/reset.
```
```sql
revoke all on all tables in schema public from anon;
grant select, insert, update on devices, readings to authenticated; -- RLS still applies
alter default privileges in schema public revoke all on tables from anon;
```

**Implementation Guidance:**
- Never expose service role key with `EXPO_PUBLIC_` prefix; check bundle in CI.
- Enable RLS on every table (`alter table ... enable row level security`).
- Create dedicated Postgres functions with `security definer` only where needed, with fixed `search_path`.

**Success Criteria:**
- [ ] Service role used only in listed server modules
- [x] `anon` has no table privileges; all tables have RLS enabled
- [ ] CI check fails if service role key string pattern appears in mobile bundle

**Status:** Applied
