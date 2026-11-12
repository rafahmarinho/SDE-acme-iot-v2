---
name: t2486-encrypt-and-sign-remote-updates-server
description: On the ACME IoT API, sign (and optionally encrypt) every firmware release with a server-held key and deliver it over TLS, so simulated devices can verify origin and integrity before install.
---

# T2486: Encrypt and sign all remote code/updates (server side)

**Category:** CODE_FIX
**SD Elements:** [T2486](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T2486/)
**Priority:** 9

**Spec Context:**
> "Simule dispositivos offline, bateria baixa, reconexão e atualizações de firmware com progresso e rollback. Use serviços HTTP para simular a comunicação" (Simulate ... firmware updates with progress and rollback. Use HTTP services to simulate communication)
> Source: specs/PRD.md, lines 33-37
> "com uma API TypeScript na Vercel" (with a TypeScript API on Vercel) — Source: specs/PRD.md, line 19

**What the spec implies (naive approach):**
Admin uploads a firmware file to Storage and the rollout just sends devices the public URL over HTTP.

**Secure Implementation Pattern:**
```typescript
// apps/api/src/lib/firmwareSigning.ts
import { createHash, createPrivateKey, sign, randomBytes, createCipheriv } from 'node:crypto';
const key = createPrivateKey(process.env.FIRMWARE_SIGNING_PRIVATE_KEY!); // Ed25519, Vercel env only

export function buildRelease(blob: Buffer, model: string, version: string, deviceKey?: Buffer) {
  let payload = blob, enc: { iv: string; tag: string } | undefined;
  if (deviceKey) { // optional confidentiality: AES-256-GCM
    const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', deviceKey, iv);
    payload = Buffer.concat([c.update(blob), c.final()]); enc = { iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64') };
  }
  const body = { version, model, size: payload.length, sha256: createHash('sha256').update(payload).digest('hex'), enc };
  return { body, payload, signature: sign(null, Buffer.from(JSON.stringify(body)), key).toString('base64') };
}
```

**Implementation Guidance:**
- Only owner/admin can create releases; signing happens server-side in the Vercel API, never in the client.
- Encrypt-then-sign: signature covers the hash of exactly what is delivered.
- Deliver over HTTPS only via short-lived signed URLs; record each rollout step (progress, rollback) in events.
- Keep the private key in Vercel env (or a KMS); plan key rotation with versioned public keys on devices.

**Success Criteria:**
- [ ] Every firmware release has a server-generated signature and hash
- [ ] Private signing key never leaves server-side env
- [ ] Devices receive updates only over TLS with signed URLs

**Status:** Pending
