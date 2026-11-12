---
name: t558-authenticate-components-before-communication
description: Mutually authenticate the Vercel API, simulated device HTTP services, integrations and Supabase before exchanging data (HMAC-signed device messages, JWT-verified clients, server-only service credentials).
---

# T558: Authenticate all other components before any network communication with them

**Category:** CODE_FIX
**SD Elements:** [T558](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T558/)
**Priority:** 9

**Spec Context:**
> "Use serviços HTTP para simular a comunicação, sem depender de um broker MQTT."
> (Use HTTP services to simulate the communication, without an MQTT broker.)
> Source: specs/PRD.md, line 37
> "Mostre o estado desejado e o estado informado pelo dispositivo." (Show desired state and device-reported state) — lines 31

**What the spec implies (naive approach):**
Open HTTP endpoints where any caller can POST "reported state" for any device ID, and the API calls
the simulator without proving its own identity.

**Secure Implementation Pattern:**
```ts
// apps/api/api/devices/report.ts — device -> API (reported state)
import { verifyHmac } from '../../src/lib/hmac';
export default async function handler(req, res) {
  const raw = await readRaw(req, 4_096);
  const ts = Number(req.headers['x-acme-timestamp']);
  if (!ts || Math.abs(Date.now() - ts) > 60_000) return res.status(401).end();
  const deviceId = String(req.headers['x-acme-device-id']);
  const secret = await getDeviceSecret(deviceId);           // per-device secret, hashed at rest
  if (!secret || !verifyHmac(`${ts}.${deviceId}.${raw}`, String(req.headers['x-acme-signature']), secret))
    return res.status(401).end();
  // ...persist reported state for deviceId only
}
// API -> simulator: sign outgoing commands the same way with DEVICE_SIM_SHARED_SECRET
```

**Implementation Guidance:**
- Client → API: verify Supabase JWT (`supabase.auth.getUser(token)`) on every request.
- Device ↔ API: per-device secret issued at registration; HMAC over timestamp + device id + body;
  reject replays (timestamp window + nonce table).
- API → Supabase: service role only server-side (T248); prefer user-scoped client for user actions.
- Integrations: signed requests or OAuth client credentials, never anonymous.

**Success Criteria:**
- [x] No API route accepts unauthenticated requests (except health check).
- [x] Device report endpoint rejects bad/missing signatures and stale timestamps.
- [x] Outgoing simulator calls are signed.

**Status:** Applied
