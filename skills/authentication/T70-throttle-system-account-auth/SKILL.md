---
name: t70-throttle-system-account-auth
description: Throttle or lock out repeated failed authentication by system accounts (device simulator, integrations) and end users against the Vercel API.
---

# T70: Implement account lockout or authentication throttling for system accounts

**Category:** CODE_FIX
**SD Elements:** [T70](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T70/)
**Priority:** 8

**Spec Context:**
> "Use serviços HTTP para simular a comunicação..." (Use HTTP services to simulate communication...)
> Source: specs/PRD.md, L37
> "...integrações e equipe." (...integrations and team.)
> Source: specs/PRD.md, L25

**What the spec implies (naive approach):**
Device/integration HTTP endpoints that check a shared secret on every call with no limit on failed attempts, allowing brute force of device credentials.

**Secure Implementation Pattern:**
```ts
// apps/api/src/middleware/rateLimit.ts
export async function guardSystemAuth(principalId: string, ip: string, ok: boolean) {
  const key = `authfail:${principalId}`;
  if (ok) { await kv.del(key); return; }
  const fails = await kv.incr(key);
  await kv.expire(key, 15 * 60);
  if (fails >= 5) {
    const backoff = Math.min(2 ** (fails - 5) * 30, 3600); // exponential, capped
    await kv.set(`authlock:${principalId}`, '1', { ex: backoff });
    await logEvent('system_auth_locked', { principalId, ip, fails });
  }
}
export async function assertNotLocked(principalId: string) {
  if (await kv.get(`authlock:${principalId}`)) throw new HttpError(429, 'Try later');
}
```

**Implementation Guidance:**
- Use a shared store (Upstash/Vercel KV or a Supabase table) since serverless instances don't share memory.
- Key on principal id AND source IP; exponential backoff instead of permanent lockout.
- Raise an alert (PRD "alertas") when a device/integration is locked.
- End-user login throttling: keep Supabase Auth rate limits enabled and add CAPTCHA after failures.

**Success Criteria:**
- [ ] 5+ failed system auths trigger backoff and an event/alert
- [x] Throttle state is shared across serverless instances
- [x] Successful auth resets the counter

**Status:** Applied
**Applied in:** apps/api/src/middleware/rateLimit.ts (`assertSystemAuthNotLocked`, `recordSystemAuthFailure`, `resetSystemAuthFailures` — per principal and per IP, Postgres-backed, 5 failures / 15 min lockout), apps/api/src/middleware/systemAuth.ts. Lockouts are logged (`system_auth_locked`); org alert row creation: Layer C.
