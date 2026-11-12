---
name: t573-prevent-registry-discovery-spoofing
description: Prevent spoofing of the ACME IoT device registry - only trust signed/authenticated registration and discovery data, so attackers cannot inject fake devices or redirect the API to malicious device endpoints.
---

# T573: Prevent UDDI/ebXML spoofing

**Category:** CODE_FIX
**SD Elements:** [T573](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T573/)
**Priority:** 8

**Spec Context:**
> "Permita cadastrar dispositivos por QR code ou código manual" (Allow registering devices by QR code or manual code) — Source: specs/PRD.md, lines 27-29
> "Use serviços HTTP para simular a comunicação, sem depender de um broker MQTT." (Use HTTP services to simulate communication, without an MQTT broker.) — Source: specs/PRD.md, line 37

ACME IoT does not use UDDI/ebXML; the analogous registry is the device inventory that maps devices to HTTP endpoints.

**What the spec implies (naive approach):**
A device (or QR code) announces its own HTTP endpoint URL and capabilities, and the API stores and calls it — a forged
announcement can register fake devices or point commands at an attacker-controlled host.

**Secure Implementation Pattern:**
```typescript
// Registration data comes from a signed provisioning record, not from the device's own claims
const Provisioning = z.object({ model: z.enum(['thermostat', 'smart_plug', 'temp_sensor', 'humidity_sensor', 'occupancy_sensor']), serial: z.string().max(64), claimCodeHash: z.string() });
export function verifyProvisioning(record: unknown, signatureB64: string) {
  const body = Provisioning.parse(record);
  const ok = verify(null, Buffer.from(JSON.stringify(body)), MANUFACTURER_PUBLIC_KEY, Buffer.from(signatureB64, 'base64'));
  if (!ok) throw new Error('untrusted provisioning record');
  return body;
}
// Device endpoint is derived server-side from config, never taken from the device/QR
const endpointFor = (deviceId: string) => new URL(`/devices/${deviceId}`, process.env.DEVICE_SIM_BASE_URL);
```

**Implementation Guidance:**
- Seed/demo and simulated devices are inserted only via signed provisioning records or admin-only server actions.
- Never accept endpoint URLs or capability lists from devices/QR codes; derive from model + server config (also mitigates SSRF, T1365).
- Authenticate devices (T558) before accepting discovery/heartbeat updates.

**Success Criteria:**
- [x] Unsigned or altered provisioning records are rejected (provisioning trust = server-side hashed one-time registration code verified by `claim_device`; manufacturer-signed records are not used in the simulation)
- [x] Device endpoints never come from client-supplied data
- [x] Heartbeats from unauthenticated devices are ignored

**Status:** Applied
