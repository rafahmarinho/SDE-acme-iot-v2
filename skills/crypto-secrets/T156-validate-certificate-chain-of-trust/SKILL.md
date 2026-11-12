---
name: t156-validate-certificate-chain-of-trust
description: Never disable TLS certificate validation in the Vercel API's outbound calls (device simulator, integrations, Supabase) or in the Expo app.
---

# T156: Validate certificate and its chain of trust properly

**Category:** CODE_FIX
**SD Elements:** [T156](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T156/)
**Priority:** 7

**Spec Context:**
> "...com integrações externas simuladas." (with simulated external integrations)
> Source: specs/PRD.md, line 9
> "Use serviços HTTP para simular a comunicação..." — specs/PRD.md, line 37

**What the spec implies (naive approach):**
Simulated services often run with self-signed certificates, and developers "fix" errors with
`NODE_TLS_REJECT_UNAUTHORIZED=0` or `rejectUnauthorized: false`, which then leaks into production.

**Secure Implementation Pattern:**
```ts
// apps/api/src/lib/httpClient.ts
import { Agent } from 'undici';

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  throw new Error('TLS validation must not be disabled');
}
// If a private CA is used for the simulator, trust it explicitly instead of disabling checks
export const dispatcher = new Agent({
  connect: process.env.DEVICE_SIM_CA_PEM ? { ca: process.env.DEVICE_SIM_CA_PEM } : {},
});
export const secureFetch = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, dispatcher } as RequestInit);
```

**Implementation Guidance:**
- Grep-ban `rejectUnauthorized: false` and `NODE_TLS_REJECT_UNAUTHORIZED` in CI.
- Use publicly trusted certs (Vercel/Supabase defaults) for every hosted endpoint.
- For a private simulator CA, pin the CA bundle via env var — do not skip validation.
- Hostname verification must remain enabled (default in Node/undici).

**Success Criteria:**
- [x] No code or config disables certificate validation.
- [x] Startup check fails if `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- [x] Outbound calls use the shared `secureFetch` helper. (implemented as `safeOutboundFetch` in apps/api/src/services/outbound.ts; private CA via NODE_EXTRA_CA_CERTS, never by disabling validation)

**Status:** Applied
