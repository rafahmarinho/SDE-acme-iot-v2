---
name: t165-dont-rely-on-udid-in-security-controls
description: In ACME IoT, device serials, QR payloads and phone identifiers must not act as authentication or authorization - registration requires an authenticated user with a role plus a single-use, high-entropy claim code.
---

# T165: Do not rely on Unique Device ID values in security controls

**Category:** CODE_FIX
**SD Elements:** [T165](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T165/)
**Priority:** 9

**Spec Context:**
> "Permita cadastrar dispositivos por QR code ou código manual" (Allow registering devices by QR code or manual code)
> Source: specs/PRD.md, lines 27-29
> "Use serviços HTTP para simular a comunicação" (Use HTTP services to simulate communication) — Source: specs/PRD.md, line 37

**What the spec implies (naive approach):**
Claim a device by posting its serial number (printed on the QR label), and let simulated devices authenticate reports
by sending their serial — anyone who knows/guesses a serial can claim or spoof the device.

**Secure Implementation Pattern:**
```typescript
// apps/api/api/devices/index.ts - claim flow
const Claim = z.object({ claimCode: z.string().regex(/^[A-Z2-9]{12}$/), roomId: z.string().uuid() });
export default withAuth(async (req, res, ctx) => {
  if (!['owner', 'admin'].includes(ctx.role)) return res.status(403).end();
  const { claimCode, roomId } = Claim.parse(req.body);
  const device = await ctx.db.claimDevice({ codeHash: sha256(claimCode), roomId, orgId: ctx.orgId }); // single-use
  if (!device) return res.status(404).json({ error: 'Invalid or used code' });
  // Issue per-device credential for the simulator (random secret), not the serial
  const deviceSecret = randomBytes(32).toString('base64url');
  await ctx.db.setDeviceCredential(device.id, await hashSecret(deviceSecret));
  return res.status(201).json({ id: device.id });
});
```

**Implementation Guidance:**
- Serial/UDID = identifier only, never a credential or authz factor.
- QR/manual code: random ≥60-bit claim code, hashed at rest, single-use, expiring, rate-limited (T1362).
- Device → API reports authenticated with per-device secret/HMAC (T558), not serial.
- Do not bind user sessions to phone hardware IDs.

**Success Criteria:**
- [ ] Knowing a serial alone cannot claim or impersonate a device
- [ ] Claim codes are single-use and hashed
- [ ] Device reports require a per-device credential

**Status:** Pending
