---
name: t42-no-untrusted-server-side-selection
description: Never let request data select server-side handlers, templates, files, simulation scenarios or table/column names in the Vercel API; use allow-lists.
---

# T42: Avoid relying on untrusted data for server-side selection

**Category:** CODE_FIX
**SD Elements:** [T42](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T42/)
**Priority:** 10

**Spec Context:**
> "Inclua uma área para escolher cenários, avançar a simulação, consultar eventos e reiniciar os dados." (Include an area to choose scenarios, advance the simulation, view events and reset data.)
> Source: specs/PRD.md, L43-45
> "...busca, filtros..." (...search, filters...)
> Source: specs/PRD.md, L11

**What the spec implies (naive approach):**
`POST /api/simulation { scenario: "offline-batch" }` doing `await import(\`../scenarios/${scenario}\`)`, or sort/filter params interpolated as column names (`.order(req.query.sort)`).

**Secure Implementation Pattern:**
```ts
// apps/api/api/simulation/index.ts
const SCENARIOS = {
  'device-offline': deviceOffline,
  'low-battery': lowBattery,
  'reconnect': reconnect,
  'firmware-update': firmwareUpdate,
} as const;
const Body = z.object({ scenario: z.enum(Object.keys(SCENARIOS) as [keyof typeof SCENARIOS]) });
const { scenario } = Body.parse(req.body);
await SCENARIOS[scenario](orgId);

// Filters/sort
const SortSchema = z.enum(['name', 'created_at', 'battery']);
const Filter = z.object({ type: z.enum(['thermostat', 'plug', 'temp_sensor', 'humidity_sensor', 'occupancy_sensor']).optional() });
```

**Implementation Guidance:**
- Map user choices to server-side constants; validate with `z.enum`.
- Range-check numeric inputs (setpoint, intervals, page size).
- Never build file paths, imports or SQL identifiers from input.

**Success Criteria:**
- [ ] No dynamic import/require/path built from request data
- [ ] Sort/filter/scenario params validated against enums
- [ ] Unknown values return 400

**Status:** Pending
