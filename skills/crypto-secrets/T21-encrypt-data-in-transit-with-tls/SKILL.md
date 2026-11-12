---
name: t21-encrypt-data-in-transit-with-tls
description: Ensure all traffic between the Expo app (iOS/Android/Web), the Vercel API, Supabase and the simulated device HTTP services is carried over TLS 1.2+ and that plaintext authentication requests are refused.
---

# T21: Ensure all data in transit is encrypted using a secure TLS channel

**Category:** CODE_FIX
**SD Elements:** [T21](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T21/)
**Priority:** 8

**Spec Context:**
> "Use serviços HTTP para simular a comunicação, sem depender de um broker MQTT."
> (Use HTTP services to simulate the communication, without depending on an MQTT broker.)
> Source: specs/PRD.md, lines 37
> "...login por e-mail e senha..." (email and password login) — specs/PRD.md, lines 5-7

**What the spec implies (naive approach):**
"HTTP services" read literally leads to `http://` base URLs for the device simulator and local API, with
credentials and control commands (setpoints, plug on/off) sent in cleartext.

**Secure Implementation Pattern:**
```ts
// packages/shared/src/config.ts
export function requireHttps(url: string, name: string): string {
  const u = new URL(url);
  const isLocalDev = process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(u.hostname);
  if (u.protocol !== 'https:' && !isLocalDev) throw new Error(`${name} must use https`);
  return u.toString();
}
export const API_BASE_URL = requireHttps(process.env.EXPO_PUBLIC_API_BASE_URL!, 'API_BASE_URL');

// apps/api/src/middleware/securityHeaders.ts
export function withTransportSecurity(res: import('http').ServerResponse) {
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
}

// apps/api/src/lib/deviceSimClient.ts — never downgrade
const DEVICE_SIM_BASE = requireHttps(process.env.DEVICE_SIM_BASE_URL!, 'DEVICE_SIM_BASE_URL');
```

**Implementation Guidance:**
- All base URLs (Supabase, API, device simulator, integrations) validated as `https:` at startup in production.
- Vercel and Supabase terminate TLS 1.2/1.3 by default; do not add custom domains without TLS.
- Send HSTS from the API and from the web build's `vercel.json` headers.
- Reject login/token requests that arrive without TLS (`x-forwarded-proto !== 'https'` → 400).
- Supabase Realtime must use `wss://` (the SDK does this when the URL is `https://`).

**Success Criteria:**
- [ ] No `http://` URL in any production config or `.env.example` (except localhost dev).
- [ ] API responses include `Strict-Transport-Security`.
- [ ] Startup fails fast if a non-HTTPS URL is configured in production.
- [ ] Simulated device calls are made only over HTTPS.

**Status:** Pending
