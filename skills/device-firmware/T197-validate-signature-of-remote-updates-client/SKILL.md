---
name: t197-validate-signature-of-remote-updates-client
description: The simulated ACME IoT device must verify size, origin signature and hash of every firmware update before applying it, rolling back on failure; Expo OTA updates must use code signing.
---

# T197: Validate the signature of all remote code/updates to verify their origin and integrity (client side)

**Category:** CODE_FIX
**SD Elements:** [T197](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T197/)
**Priority:** 9

**Spec Context:**
> "Simule dispositivos offline, bateria baixa, reconexão e atualizações de firmware com progresso e rollback." (Simulate offline devices, low battery, reconnection and firmware updates with progress and rollback.)
> Source: specs/PRD.md, lines 33-37

**What the spec implies (naive approach):**
The simulator downloads `firmware.bin` from a URL in the rollout record and marks the device as updated, with no
size, signature or hash checks — any tampered or oversized artifact is "installed".

**Secure Implementation Pattern:**
```typescript
// apps/api/src/services/deviceSimulator/applyFirmware.ts (device side of the simulation)
import { createHash, verify } from 'node:crypto';
const MAX_FW_BYTES = 8 * 1024 * 1024;

export async function applyFirmware(device: SimDevice, manifest: SignedManifest, blob: Buffer) {
  if (blob.length > MAX_FW_BYTES || blob.length !== manifest.size) throw new Error('size mismatch');
  const payload = Buffer.from(JSON.stringify(manifest.body)); // canonical body: {version, sha256, size, model}
  if (!verify(null, payload, TRUSTED_FW_PUBLIC_KEY, Buffer.from(manifest.signature, 'base64'))) throw new Error('bad signature');
  if (createHash('sha256').update(blob).digest('hex') !== manifest.body.sha256) throw new Error('hash mismatch');
  if (manifest.body.model !== device.model || semverLte(manifest.body.version, device.version)) throw new Error('not applicable');
  await device.stage(blob);            // only after all checks
  await device.reboot().catch(() => device.rollback());
}
```

**Implementation Guidance:**
- Device trusts a pinned public key (Ed25519) provisioned at registration; never fetch the key with the update.
- Check size → signature → hash → model/version (anti-downgrade) before staging; decrypt only after verification (T2486).
- Report each stage to the rollout record (progress) and auto-rollback on failed verification or boot.
- Expo OTA (expo-updates): enable code signing (`updates.codeSigningCertificate`) or disable OTA.

**Success Criteria:**
- [ ] Tampered, unsigned, oversized or downgrade firmware is rejected by the simulator
- [ ] Failed verification triggers rollback and an event entry
- [ ] Expo OTA updates are code-signed or disabled

**Status:** Pending
