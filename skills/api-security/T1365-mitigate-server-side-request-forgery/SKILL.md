---
name: t1365-mitigate-server-side-request-forgery
description: Prevent SSRF in the Vercel API when calling simulated devices and simulated external integrations by using strict host allow-lists and never fetching user-supplied URLs directly.
---

# T1365: Mitigate Server Side Request Forgery

**Category:** CODE_FIX
**SD Elements:** [T1365](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T1365/)
**Priority:** 8

**Spec Context:**
> "Crie telas de dashboard, prédios, salas, cadastro e detalhe de dispositivos, automações, alertas, eventos, firmware, integrações e equipe."
> (Create screens for ... integrations and team.)
> Source: specs/PRD.md, lines 23-25
> "...com integrações externas simuladas." — line 9

**What the spec implies (naive approach):**
An integrations screen where an admin types a webhook/endpoint URL, or a device record storing its
own "endpoint URL", which the API then fetches — reaching internal metadata or Supabase admin endpoints.

**Secure Implementation Pattern:**
```ts
// apps/api/src/lib/outbound.ts
const ALLOWED_HOSTS = new Set(
  (process.env.OUTBOUND_ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean),
);
export async function safeOutboundFetch(target: string, init: RequestInit = {}) {
  const url = new URL(target);
  if (url.protocol !== 'https:') throw new Error('scheme not allowed');
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error('host not allowed');
  const res = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(5_000) });
  if (res.status >= 300 && res.status < 400) throw new Error('redirects not allowed');
  return res;
}
// Devices are addressed by ID; the API maps deviceId -> simulator route, never a stored URL.
```

**Implementation Guidance:**
- Simulated integrations are chosen from a fixed catalog (enum), not free-form URLs.
- Device simulator base URL comes from env; path built from validated device id only.
- Block redirects, non-https schemes, and set timeouts/response size caps (T536).
- Validate response shape (zod) before using/returning it.

**Success Criteria:**
- [ ] No `fetch()` of user-controlled URLs anywhere in `apps/api`.
- [ ] All outbound calls go through `safeOutboundFetch`.
- [ ] Integrations use catalog identifiers, not URLs.

**Status:** Pending
