---
name: t38-bind-variables-in-sql-statements
description: Use parameterized queries everywhere (supabase-js query builder, RPC arguments, plpgsql with format %L/%I or USING) for search, filters and simulation SQL; never concatenate user input into SQL.
---

# T38: Bind variables in SQL statements

**Category:** CODE_FIX
**SD Elements:** [T38](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T38/)
**Priority:** 10

**Spec Context:**
> "Inclua login, recuperação de senha, perfil, configurações, busca, filtros..."
> (Include login, password recovery, profile, settings, search, filters...)
> Source: specs/PRD.md, line 11
> "Supabase para PostgreSQL" — line 5

**What the spec implies (naive approach):**
Implementing search/filters with string-built SQL in an RPC (`EXECUTE 'SELECT ... WHERE name ILIKE ''%' || q || '%'''`)
or building PostgREST `.or()` filter strings from raw user text.

**Secure Implementation Pattern:**
```sql
-- supabase/migrations/00xx_search.sql
create or replace function public.search_devices(p_org uuid, p_query text, p_type text default null)
returns setof public.devices
language sql stable security invoker as $$
  select * from public.devices
  where organization_id = p_org
    and name ilike '%' || p_query || '%'        -- p_query is a bound parameter, not concatenated SQL
    and (p_type is null or type = p_type)
  limit 100;
$$;
-- Dynamic identifiers (sort column) only via allow-list + format('%I', col) ... EXECUTE ... USING
```
```ts
// client/API
const { data } = await supabase.rpc('search_devices', { p_org: orgId, p_query: q, p_type: type ?? null });
// query builder is parameterized too:
await supabase.from('devices').select(COLS).ilike('name', `%${escapeLike(q)}%`);
```

**Implementation Guidance:**
- Prefer supabase-js builder / RPC with named args; both bind parameters.
- Never interpolate user input into `.or()`/`.filter()` raw strings; validate enums (type, status).
- In plpgsql `EXECUTE`, use `USING` for values and `format('%I')` for allow-listed identifiers.
- Escape `%`/`_` in LIKE patterns.

**Success Criteria:**
- [x] No string-concatenated SQL in migrations/functions with user input.
- [x] Sort/filter fields validated against allow-lists.
- [x] SQL injection payloads in search return no extra rows (test).

**Status:** Applied
