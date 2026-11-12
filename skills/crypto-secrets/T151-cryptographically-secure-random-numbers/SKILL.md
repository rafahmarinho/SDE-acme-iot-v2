---
name: t151-cryptographically-secure-random-numbers
description: Generate device manual registration codes, QR claim tokens, invite tokens and secrets with a CSPRNG (crypto.randomBytes / expo-crypto), never Math.random.
---

# T151: Use cryptographically secure random numbers

**Category:** CODE_FIX
**SD Elements:** [T151](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T151/)
**Priority:** 7

**Spec Context:**
> "Permita cadastrar dispositivos por QR code ou código manual..."
> (Allow registering devices by QR code or manual code...)
> Source: specs/PRD.md, lines 27-29
> "...equipe." (team screen — member invites) — line 25

**What the spec implies (naive approach):**
Generating manual device codes like `Math.random().toString(36).slice(2,8)` or sequential codes, letting
an attacker guess codes and claim other organizations' devices.

**Secure Implementation Pattern:**
```ts
// apps/api/src/lib/codes.ts
import { randomBytes, randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
export function manualDeviceCode(len = 10): string {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out; // ~50 bits; also enforce single-use + expiry + throttling (T1362)
}
export function claimToken(): string {
  return randomBytes(32).toString('base64url'); // QR payload / invite tokens
}
```
```ts
// client side, if ever needed: import * as Crypto from 'expo-crypto'; Crypto.getRandomBytes(32)
```

**Implementation Guidance:**
- Ban `Math.random` for anything security-relevant (ESLint `no-restricted-properties`).
- Simulation randomness (sensor noise) may use a seeded PRNG — keep it separate from security code.
- Store only a hash of claim/invite tokens in the DB; make them single-use and time-limited.

**Success Criteria:**
- [x] All codes/tokens come from `node:crypto` or `expo-crypto`.
- [x] Lint rule blocks `Math.random` in `apps/api/src` security modules.
- [ ] Registration codes are single-use with expiry.

**Status:** Applied
**Applied in:** apps/api/src/lib/crypto.ts (`newRegistrationCode` via randomInt, `newToken`/`newSystemCredential` via randomBytes, `newRequestId` via randomUUID), apps/api/eslint.config.js (Math.random banned). Single-use/expiry: Layer A `claim_device`.
