---
name: t49-remove-debug-code-and-prepare-release
description: Strip debug menus, dev-only endpoints, verbose logging and test backdoors from production Expo builds and the Vercel API; gate the simulation area by role and environment.
---

# T49: Disable and remove debug capabilities and code/data, and prepare application for release

**Category:** CODE_FIX
**SD Elements:** [T49](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T49/)
**Priority:** 7

**Spec Context:**
> "Inclua uma área para escolher cenários, avançar a simulação, consultar eventos e reiniciar os dados."
> (Include an area to choose scenarios, advance the simulation, query events and reset the data.)
> Source: specs/PRD.md, lines 43-45
> "Inclua as versões Android e iOS e instruções para gerar os pacotes nativos." — line 59

**What the spec implies (naive approach):**
The simulation/reset area behaves like a debug console reachable by anyone, plus `console.log` of
tokens and a "skip login" dev shortcut left in release builds.

**Secure Implementation Pattern:**
```ts
// apps/api/api/simulation/index.ts
if (process.env.ENABLE_SIMULATION !== 'true') return res.status(404).end();
const { role } = await requireMember(req, orgId);
if (!['owner', 'admin'].includes(role)) return res.status(403).end();   // reset/advance restricted

// apps/mobile/src/services/logger.ts
export const log = (...a: unknown[]) => { if (__DEV__) console.log(...a); };

// babel.config.js (production): strip console.* 
// plugins: process.env.NODE_ENV === 'production' ? ['transform-remove-console'] : []
```

**Implementation Guidance:**
- Production EAS profile: `developmentClient: false`, no expo-dev-menu, Hermes enabled, source maps
  uploaded privately (not shipped publicly).
- Remove test accounts/backdoors; seed data only for demo environment.
- Simulation endpoints controlled by env flag and owner/admin role; reset scoped to the caller's org.
- Remove unused routes/files before release (checklist in README).

**Success Criteria:**
- [ ] Release builds contain no dev menu, no console token logging, no auth bypass.
- [ ] Simulation reset/advance requires owner/admin and is disabled when the flag is off.
- [ ] Release checklist documented and followed.

**Status:** Pending
