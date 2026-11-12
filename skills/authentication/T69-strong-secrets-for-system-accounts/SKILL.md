---
name: t69-strong-secrets-for-system-accounts
description: Ensure server-to-server credentials (Supabase service role, device simulator shared secret, integration keys) meet at least end-user password strength.
---

# T69: Strong password requirements for server-to-server system accounts

**Category:** CODE_FIX
**SD Elements:** [T69](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T69/)
**Priority:** 8

**Spec Context:**
> "...com uma API TypeScript na Vercel." (...with a TypeScript API on Vercel.)
> Source: specs/PRD.md, L19
> "Use serviços HTTP para simular a comunicação, sem depender de um broker MQTT." (Use HTTP services to simulate communication, without an MQTT broker.)
> Source: specs/PRD.md, L37

**What the spec implies (naive approach):**
A simple shared secret like `device123` (or the same value for every simulated device and integration) used between the Vercel API and the HTTP device simulator.

**Secure Implementation Pattern:**
```ts
// apps/api/src/lib/config.ts
import { z } from 'zod';
const Secret = z.string().min(32, 'secret must be >= 32 chars of high entropy');
export const config = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
  DEVICE_SIM_SHARED_SECRET: Secret,
}).parse(process.env); // fail fast at cold start

// Per-device credentials generated at registration time:
import { randomBytes, createHash } from 'node:crypto';
export function newDeviceCredential() {
  const secret = randomBytes(32).toString('base64url');     // shown once
  const hash = createHash('sha256').update(secret).digest('hex'); // stored
  return { secret, hash };
}
```

**Implementation Guidance:**
- Generate system/device secrets with a CSPRNG (≥ 256 bits); never human-chosen.
- Unique credential per simulated device and per integration; store only hashes in `devices`/`integrations`.
- Validate secret strength at startup; refuse to boot with weak/missing values.
- Rotate secrets on schedule and on compromise; document rotation in README.

**Success Criteria:**
- [x] All system secrets are ≥ 32 random bytes and validated at startup
- [ ] Each device/integration has its own credential; only hashes are persisted
- [x] No default or sample secret values work in any deployed environment

**Status:** Applied
**Applied in:** apps/api/src/lib/env.ts (≥32-byte secrets, placeholder values rejected, fail at cold start), apps/api/src/lib/crypto.ts (`newSystemCredential`: 256-bit secret + SHA-256 hash for persistence), apps/api/src/middleware/systemAuth.ts (HMAC-signed system requests with replay window). Persisting per-device hashes: Layer A/C.
