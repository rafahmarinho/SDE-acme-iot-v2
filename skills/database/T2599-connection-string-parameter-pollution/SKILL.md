---
name: t2599-connection-string-parameter-pollution
description: Build Supabase/Postgres connection settings only from trusted environment configuration, never from request data such as org selection, so attackers cannot redirect or downgrade database connections.
---

# T2599: Protect against connection string parameter pollution

**Category:** CODE_FIX
**SD Elements:** [T2599](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T2599/)
**Priority:** 9

**Spec Context:**
> "As versões web e mobile devem compartilhar o mesmo projeto Supabase."
> (The web and mobile versions must share the same Supabase project.)
> Source: specs/PRD.md, lines 47-49
> "...navegação por organização, prédio e sala." (navigation by organization, building and room) — lines 21-23

**What the spec implies (naive approach):**
Multi-organization navigation tempts "per-org database" logic that builds a connection string or
Supabase URL from a request parameter (`?org=` / header), or appends user values to a Postgres DSN.

**Secure Implementation Pattern:**
```ts
// apps/api/src/lib/db.ts
import postgres from 'postgres';
import { env } from './env';

// Single, fixed DSN from env; sslmode enforced; nothing request-derived
export const sql = postgres(env.databaseUrl, { ssl: 'require', max: 1, prepare: false });

// Tenant selection happens in queries (organization_id + RLS), NOT in the connection
export async function listRooms(orgId: string) {
  return sql`select id, name from public.rooms where organization_id = ${orgId}`;
}
```

**Implementation Guidance:**
- `SUPABASE_URL` / `DATABASE_URL` come only from env; validate format at startup.
- Never accept host, db name, user, `sslmode` or options from clients.
- Organization scoping is done through `organization_id` columns and RLS.
- Clients use only the fixed `EXPO_PUBLIC_SUPABASE_URL`.

**Success Criteria:**
- [x] No code builds connection strings from request input.
- [x] Connections enforce TLS (`ssl: 'require'`).
- [ ] Tenant isolation verified via RLS tests, not separate connections.

**Status:** Applied
**Applied in:** apps/api/src/lib/env.ts + packages/shared/src/url.ts (SUPABASE_URL parsed, https-only, reduced to origin, no embedded credentials), apps/api/src/lib/supabase.ts (single fixed origin; tenant scoping via org_id + RLS). No raw Postgres DSN is used; Supabase REST/Realtime is HTTPS/WSS only.
