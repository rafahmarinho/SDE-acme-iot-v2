---
name: t1144-prevent-server-side-template-injection
description: Render automation notification and alert messages from fixed, logic-less templates with escaped variables; never compile user-authored text (automation names, device names) as a template.
---

# T1144: Prevent Server-Side Template Injection (SSTI)

**Category:** CODE_FIX
**SD Elements:** [T1144](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T1144/)
**Priority:** 8

**Spec Context:**
> "Crie automações simples de condição e ação, com intervalo entre execuções, histórico e notificações."
> (Create simple condition/action automations with cooldown, history and notifications.)
> Source: specs/PRD.md, lines 31-33

**What the spec implies (naive approach):**
Letting users write custom notification text like `"{{device.name}} is {{reading}}"` and compiling
it server-side with Handlebars/EJS/`new Function`, enabling code execution in the Vercel function.

**Secure Implementation Pattern:**
```ts
// apps/api/src/lib/notifications.ts
const TEMPLATES = {
  'threshold.exceeded': 'Automation "{automation}" triggered: {metric} on {device} is {value}.',
  'device.offline': 'Device {device} in {room} went offline.',
  'battery.low': 'Device {device} battery is at {value}%.',
} as const;
type Key = keyof typeof TEMPLATES;

export function render(key: Key, vars: Record<string, string | number>): string {
  return TEMPLATES[key].replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]).slice(0, 120) : '');   // plain substitution, no evaluation
}
// HTML emails: escape values (e.g. with `escape-html`) before inserting.
```

**Implementation Guidance:**
- Template set is fixed in code (or a DB enum); users pick a template key and parameters only.
- No `eval`, `new Function`, or runtime compilation of user strings.
- If a template engine is used, keep templates static and enable auto-escaping.
- Validate/trim variable values (length, charset).

**Success Criteria:**
- [ ] No user-supplied string is ever compiled as a template.
- [ ] `{{7*7}}`-style payloads in device/automation names are rendered literally (test).
- [ ] Email HTML output escapes variables.

**Status:** Pending
