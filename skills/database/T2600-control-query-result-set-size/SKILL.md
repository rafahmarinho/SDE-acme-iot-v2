---
name: t2600-control-query-result-set-size
description: Paginate and cap result sizes for readings, events, alerts, devices and search queries in Supabase/API, and fail safely when limits are exceeded.
---

# T2600: Control the result set size returned by a query

**Category:** CODE_FIX
**SD Elements:** [T2600](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T2600/)
**Priority:** 7

**Spec Context:**
> "...consultar leituras, mudar a temperatura e ligar ou desligar tomadas."
> (...query readings, change temperature and turn plugs on/off.)
> Source: specs/PRD.md, lines 29-31
> "...consultar eventos..." (query events) — line 45; "busca, filtros" — line 11

**What the spec implies (naive approach):**
Fetching all sensor readings or the whole events history for a device/org in one call, which grows
unbounded with simulation ticks and can exhaust the client, the API function and the database.

**Secure Implementation Pattern:**
```ts
// packages/shared/src/pagination.ts
import { z } from 'zod';
export const Page = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().datetime().optional(),   // keyset on created_at
});

// apps/api/api/devices/[id]/readings.ts
const { limit, cursor } = Page.parse(req.query);
let q = userClient.from('readings')
  .select('ts, metric, value')
  .eq('device_id', deviceId)
  .order('ts', { ascending: false })
  .limit(limit);
if (cursor) q = q.lt('ts', cursor);
```
```sql
-- also set a hard cap at the PostgREST layer: supabase/config.toml  [api] max_rows = 1000
```

**Implementation Guidance:**
- Every list endpoint takes `limit` (max 100) and keyset cursor.
- Set PostgREST `max_rows` as a global safety net.
- Aggregate historical readings (per minute/hour) for charts instead of returning raw rows.
- Realtime subscriptions filtered by room/device to avoid broadcasting org-wide streams.

**Success Criteria:**
- [ ] No list query without `.limit()`.
- [ ] `max_rows` configured in Supabase.
- [ ] Requests with `limit>100` are rejected or clamped.

**Status:** Pending
