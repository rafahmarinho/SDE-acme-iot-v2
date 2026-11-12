---
name: t161-treat-unique-device-ids-as-personal-info
description: Treat mobile hardware identifiers and IoT device serials/manual codes in ACME IoT as personal information - avoid collecting phone UDIDs, use app-scoped random IDs, and restrict/mask device serials.
---

# T161: Treat unique device IDs as personal information

**Category:** CODE_FIX
**SD Elements:** [T161](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T161/)
**Priority:** 8

**Spec Context:**
> "Permita cadastrar dispositivos por QR code ou código manual" (Allow registering devices by QR code or manual code)
> Source: specs/PRD.md, lines 27-29
> "sensores de temperatura, umidade e ocupação" (temperature, humidity and occupancy sensors) — Source: specs/PRD.md, line 27

Device serials/claim codes are tied to rooms and occupancy data and therefore to individuals.

**What the spec implies (naive approach):**
Collect the phone's hardware ID (IMEI/Android ID/IDFV) for "device binding" and show full device serials and claim
codes to every role, including viewers.

**Secure Implementation Pattern:**
```typescript
// App installation ID: random, app-scoped, resettable - never IMEI/serial
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
export async function installationId() {
  let id = await SecureStore.getItemAsync('acme.installId');
  if (!id) { id = Crypto.randomUUID(); await SecureStore.setItemAsync('acme.installId', id); }
  return id;
}
```
```sql
-- Serial visible only to admins/owners; others see a masked value
create view device_public as
select id, org_id, name, type,
  case when has_org_role(org_id, array['owner','admin']) then serial_number
       else '••••' || right(serial_number, 4) end as serial_display
from devices;
```

**Implementation Guidance:**
- Do not read IMEI/serial/ICCID of the user's phone; use a random installation ID if needed.
- Classify IoT device serials and manual claim codes as personal data: restrict by role, mask in UI/logs, never in URLs.
- Store claim codes hashed after registration; delete/rotate on device removal.
- Include identifiers in the privacy notice/consent (T178).

**Success Criteria:**
- [ ] App collects no hardware identifiers of the user's phone
- [ ] Device serials masked for operator/viewer roles and absent from logs
- [ ] Claim codes stored hashed

**Status:** Pending
