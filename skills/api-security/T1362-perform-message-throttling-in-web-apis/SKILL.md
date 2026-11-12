---
name: t1362-perform-message-throttling-in-web-apis
description: Rate-limit Vercel API endpoints per user, per IP and per device (control commands, registration code attempts, simulation advance/reset, login-adjacent flows).
---

# T1362: Perform message throttling in Web APIs

**Category:** CODE_FIX
**SD Elements:** [T1362](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T1362/)
**Priority:** 8

**Spec Context:**
> "...consultar leituras, mudar a temperatura e ligar ou desligar tomadas."
> (...query readings, change the temperature and turn plugs on or off.)
> Source: specs/PRD.md, lines 29-31
> "Inclua uma área para escolher cenários, avançar a simulação, consultar eventos e reiniciar os dados." — lines 43-45

**What the spec implies (naive approach):**
Unlimited command, registration-code and "reset data" calls allow brute-forcing manual device codes,
flooding devices with on/off toggles, or DoS-ing the shared Supabase project.

**Secure Implementation Pattern:**
```ts
// apps/api/src/middleware/rateLimit.ts — fixed window in Postgres (or Upstash/Vercel KV)
import { supabaseAdmin } from '../lib/supabaseAdmin';

export async function rateLimit(key: string, limit: number, windowSec: number) {
  const { data, error } = await supabaseAdmin.rpc('hit_rate_limit', {
    p_key: key, p_limit: limit, p_window_seconds: windowSec,
  });
  if (error) throw error;
  if (data === false) throw Object.assign(new Error('Too Many Requests'), { status: 429 });
}
// usage
await rateLimit(`cmd:${user.id}`, 30, 60);
await rateLimit(`claim:${ip}`, 5, 300);   // manual device code attempts
await rateLimit(`sim-reset:${orgId}`, 3, 3600);
```

**Implementation Guidance:**
- Key by user id (authenticated) and by IP (unauthenticated/claim endpoints).
- Return 429 with `Retry-After`; log violations to `events` for admins.
- Combine with automation cooldown from the PRD ("intervalo entre execuções") so automations
  cannot bypass device command limits.
- Supabase Auth has its own rate limits — keep them enabled in project settings.

**Success Criteria:**
- [x] Command, claim, automation and simulation endpoints are throttled.
- [x] Exceeding limits returns 429 with Retry-After.
- [ ] Violations are recorded as events.

**Status:** Applied
**Applied in:** apps/api/src/middleware/rateLimit.ts (`consume` via Postgres `consume_rate_limit`, named `LIMITS`, fail-closed), apps/api/src/lib/http.ts (every route throttled per user/IP, 429 + Retry-After). Violations are logged; per-org event rows: Layer C.
