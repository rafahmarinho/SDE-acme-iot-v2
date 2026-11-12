---
name: t160-dont-rely-on-jailbreak-root-detection
description: ACME IoT must assume the mobile app may run on rooted/jailbroken devices - device control and role checks are enforced server-side; root detection, if added, is only an additional signal.
---

# T160: Avoid relying on jailbreak or root detection as a strong security measure

**Category:** CODE_FIX
**SD Elements:** [T160](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T160/)
**Priority:** 7

**Spec Context:**
> "Permita cadastrar dispositivos por QR code ou código manual, consultar leituras, mudar a temperatura e ligar ou desligar tomadas." (Allow registering devices by QR code or manual code, reading values, changing temperature and turning plugs on/off.)
> Source: specs/PRD.md, lines 27-31
> "Tenha perfis de proprietário, administrador, operador e visualizador." (Owner, administrator, operator and viewer roles.) — Source: specs/PRD.md, line 39

**What the spec implies (naive approach):**
Gate critical actions (thermostat setpoints, plug switching, firmware rollout) with a client-side "isRooted()" check and
trust everything else the app sends.

**Secure Implementation Pattern:**
```typescript
// apps/api/api/devices/[id]/command.ts - enforcement independent of client integrity
export default withAuth(async (req, res, ctx) => {
  const device = await ctx.db.devices.findForOrg(req.query.id as string, ctx.orgId);
  if (!device) return res.status(404).end();
  if (!['owner', 'admin', 'operator'].includes(ctx.role)) return res.status(403).end();
  const cmd = CommandSchema.parse(req.body); // server-side validation
  // Optional: integrity signal (e.g., Play Integrity / App Attest) only adds to risk score, never replaces checks
  await sendToSimulatedDevice(device, cmd);
  return res.status(202).json({ status: 'queued' });
});
```

**Implementation Guidance:**
- Design every control path assuming a hostile client: auth, role, org scope and input validation on the API/RLS.
- If root/jailbreak detection is added (e.g., `expo-device` `isRootedExperimentalAsync`), use it only to warn or require re-auth for critical operations, never as the sole control.
- Do not put secrets in the app that would be "protected" by root detection.

**Success Criteria:**
- [x] No security decision depends solely on client-side root/jailbreak status
- [ ] Control commands are authorized server-side for every request
- [ ] Threat model documents rooted-device assumption

**Status:** Applied
