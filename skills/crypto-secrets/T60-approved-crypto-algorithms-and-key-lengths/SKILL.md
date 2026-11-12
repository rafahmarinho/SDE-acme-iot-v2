---
name: t60-approved-crypto-algorithms-and-key-lengths
description: Select approved algorithms and parameters (Ed25519/ECDSA P-256, SHA-256+, AES-256-GCM, HMAC-SHA256, 256-bit keys) for firmware signing, device shared secrets and any encrypted cache.
---

# T60: Use correct and approved cryptographic algorithms, parameters, and key lengths

**Category:** CODE_FIX
**SD Elements:** [T60](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T60/)
**Priority:** 8

**Spec Context:**
> "...atualizações de firmware com progresso e rollback."
> (...firmware updates with progress and rollback.)
> Source: specs/PRD.md, lines 35-37
> "...mostre os últimos dados como leitura offline." (show the latest data as offline reading) — lines 51-53

**What the spec implies (naive approach):**
Using MD5/SHA-1 checksums for firmware integrity, RSA-1024, AES-ECB or a fixed IV to encrypt the offline
cache, or short random secrets for device simulator authentication.

**Secure Implementation Pattern:**
```ts
// packages/shared/src/cryptoPolicy.ts — single source of truth
export const CRYPTO_POLICY = {
  hash: 'sha256',
  hmac: 'sha256',
  signature: 'ed25519',          // or ECDSA P-256
  symmetric: 'aes-256-gcm',      // 96-bit random IV, 128-bit tag
  minSecretBytes: 32,
} as const;

// apps/api/src/lib/hmac.ts
import { createHmac, timingSafeEqual } from 'node:crypto';
export function verifyHmac(body: string, sig: string, secret: string) {
  if (Buffer.byteLength(secret) < CRYPTO_POLICY.minSecretBytes) throw new Error('weak secret');
  const mac = createHmac(CRYPTO_POLICY.hmac, secret).update(body).digest();
  const given = Buffer.from(sig, 'hex');
  return given.length === mac.length && timingSafeEqual(mac, given);
}
```

**Implementation Guidance:**
- Forbid MD5, SHA-1, DES/3DES, RC4, ECB mode, RSA < 2048.
- AES-GCM with unique random IV per message; never reuse IV with the same key.
- Firmware: SHA-256 digest + Ed25519 signature stored with each `firmware_releases` row.
- Device simulator/integration shared secrets ≥ 32 random bytes (see T151).
- Document the policy in `packages/shared/src/cryptoPolicy.ts` and reference it everywhere.

**Success Criteria:**
- [x] No weak algorithms referenced anywhere (grep for md5, sha1, des, ecb).
- [ ] Firmware releases store SHA-256 digest and Ed25519/ECDSA signature.
- [x] Secrets are validated for minimum length at startup.

**Status:** Applied
**Applied in:** packages/shared/src/cryptoPolicy.ts (policy + forbidden list), apps/api/src/lib/crypto.ts (SHA-256/HMAC-SHA256, secret length check), apps/api/src/lib/env.ts (≥32-byte secrets, Ed25519 PEM keys), apps/api/eslint.config.js (weak-algorithm literal rule). Firmware columns: Layer A/C.
