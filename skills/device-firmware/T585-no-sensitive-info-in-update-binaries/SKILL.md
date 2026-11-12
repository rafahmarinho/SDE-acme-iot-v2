---
name: t585-no-sensitive-info-in-update-binaries
description: Ensure ACME IoT firmware artifacts and their manifests contain no secrets, internal URLs, credentials or PII; scan artifacts before publishing a release.
---

# T585: Do not expose sensitive information in the update binaries sent to devices

**Category:** CODE_FIX
**SD Elements:** [T585](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T585/)
**Priority:** 7

**Spec Context:**
> "Crie telas de ... firmware" (Create ... firmware screens) — Source: specs/PRD.md, lines 23-25
> "atualizações de firmware com progresso e rollback" (firmware updates with progress and rollback) — Source: specs/PRD.md, lines 35-37

**What the spec implies (naive approach):**
Build simulated firmware packages that embed the shared device secret, Supabase URL/keys or debug endpoints, and
publish them with a manifest that includes internal notes.

**Secure Implementation Pattern:**
```typescript
// apps/api/api/firmware/releases.ts - pre-publish gate
const FORBIDDEN = [/SUPABASE_SERVICE_ROLE/i, /eyJ[a-zA-Z0-9_-]{10,}\./, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /password\s*[:=]/i, /@[a-z0-9-]+\.[a-z]{2,}/i];
export function assertNoSecrets(blob: Buffer) {
  const text = blob.toString('latin1'); // scan printable strings
  const hit = FORBIDDEN.find((re) => re.test(text));
  if (hit) throw new Error(`Release blocked: sensitive pattern ${hit}`);
}
// Manifest exposes only what devices need
type PublicManifest = { version: string; model: string; size: number; sha256: string; releasedAt: string };
```

**Implementation Guidance:**
- Firmware never contains per-device or shared secrets; devices receive credentials at provisioning (T165).
- Run a secret/string scan on every artifact before signing (T2486); block release on findings.
- Strip debug symbols/logging strings; keep release notes for admins separate from the device manifest.
- Store artifacts in a private bucket; deliver via short-lived signed URLs.

**Success Criteria:**
- [ ] Release pipeline rejects artifacts containing secret patterns
- [ ] Device manifest contains only version/model/size/hash/date
- [ ] Artifacts stored privately and delivered via signed URLs

**Status:** Pending
