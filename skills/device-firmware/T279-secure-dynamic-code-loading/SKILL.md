---
name: t279-secure-dynamic-code-loading
description: Avoid unsafe dynamic code in ACME IoT - no eval/new Function for automation rules or integrations, no runtime-loaded remote JS, and signed Expo OTA updates only.
---

# T279: Avoid dynamically loading any code without proper security considerations

**Category:** CODE_FIX
**SD Elements:** [T279](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T279/)
**Priority:** 8

**Spec Context:**
> "Crie automações simples de condição e ação, com intervalo entre execuções, histórico e notificações." (Create simple condition-and-action automations with cooldown, history and notifications.)
> Source: specs/PRD.md, lines 31-33
> "React Native com Expo, Expo Router" — Source: specs/PRD.md, line 17 (Expo can ship JS bundles over the air)
> "integrações externas simuladas" (simulated external integrations) — Source: specs/PRD.md, line 9

**What the spec implies (naive approach):**
Store automation conditions as JS strings (`"reading.temp > 26"`) and run them with `eval`/`new Function`, load
integration "plugins" from a URL, or ship unsigned OTA bundles.

**Secure Implementation Pattern:**
```typescript
// packages/shared/src/automation.ts - declarative rules, interpreted safely
export const Rule = z.object({
  condition: z.object({
    deviceId: z.string().uuid(),
    metric: z.enum(['temperature', 'humidity', 'occupancy', 'power']),
    op: z.enum(['>', '>=', '<', '<=', '==']),
    value: z.number(),
  }),
  action: z.object({ deviceId: z.string().uuid(), command: z.enum(['set_temperature', 'plug_on', 'plug_off']), value: z.number().optional() }),
  cooldownSeconds: z.number().int().min(60).max(86400),
});
const OPS = { '>': (a: number, b: number) => a > b, '>=': (a, b) => a >= b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '==': (a, b) => a === b } as const;
export const evaluate = (r: z.infer<typeof Rule>, v: number) => OPS[r.condition.op](v, r.condition.value);
```

**Implementation Guidance:**
- Automations: declarative JSON schema + fixed interpreter; never `eval`, `Function`, `vm` or template-to-code.
- Integrations: fixed, bundled adapters selected by enum; no remote module loading.
- Expo: `expo-updates` with code signing and a pinned update URL, or disable OTA; no remote JS from WebViews.
- ESLint: enable `no-eval`, `no-new-func`, `no-implied-eval`.

**Success Criteria:**
- [ ] No eval/new Function/remote module loading in the codebase (lint enforced)
- [ ] Automation rules validated against schema before save and execution
- [ ] OTA updates signed or disabled

**Status:** Pending
