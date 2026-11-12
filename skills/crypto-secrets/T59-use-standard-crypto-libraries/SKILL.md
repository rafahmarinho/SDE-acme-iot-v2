---
name: t59-use-standard-crypto-libraries
description: Use only vetted cryptographic libraries (node:crypto / WebCrypto, expo-crypto, Supabase Auth) for firmware signing, token generation and hashing; never implement custom crypto.
---

# T59: Use standard libraries for cryptography

**Category:** CODE_FIX
**SD Elements:** [T59](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T59/)
**Priority:** 8

**Spec Context:**
> "Simule dispositivos offline, bateria baixa, reconexão e atualizações de firmware com progresso e rollback."
> (Simulate offline devices, low battery, reconnection and firmware updates with progress and rollback.)
> Source: specs/PRD.md, lines 33-37
> "...login por e-mail e senha..." — specs/PRD.md, lines 5-7

**What the spec implies (naive approach):**
Because firmware and devices are "simulated", a developer may write a home-made checksum/"signature"
(e.g. XOR or base64 of a secret) for firmware packages, or hand-roll password hashing.

**Secure Implementation Pattern:**
```ts
// apps/api/src/lib/firmwareSigning.ts
import { createHash, sign, verify, createPrivateKey, createPublicKey } from 'node:crypto';

const priv = createPrivateKey(process.env.FIRMWARE_SIGNING_PRIVATE_KEY!);
const pub = createPublicKey(process.env.FIRMWARE_SIGNING_PUBLIC_KEY!);

export function digest(buf: Buffer) {
  return createHash('sha256').update(buf).digest('hex');
}
export function signFirmware(buf: Buffer): string {
  return sign(null, buf, priv).toString('base64'); // Ed25519
}
export function verifyFirmware(buf: Buffer, sigB64: string): boolean {
  return verify(null, buf, pub, Buffer.from(sigB64, 'base64'));
}
```

**Implementation Guidance:**
- Server: `node:crypto` only. Client (Expo): `expo-crypto` / WebCrypto (`crypto.subtle`).
- Passwords are handled exclusively by Supabase Auth (bcrypt) — never hash or store passwords yourself.
- No custom ciphers, encodings-as-encryption, or copied crypto snippets.
- Add a lint rule / code-review check forbidding imports of unknown crypto packages.

**Success Criteria:**
- [x] All cryptographic operations go through `node:crypto`, WebCrypto or `expo-crypto`.
- [x] No password hashing code exists in the repo (delegated to Supabase Auth).
- [x] No custom encryption/obfuscation functions present.

**Status:** Applied
**Applied in:** apps/api/src/lib/crypto.ts (node:crypto only), packages/shared/src/cryptoPolicy.ts, apps/api/eslint.config.js (crypto-js/md5/sha1 imports banned).
