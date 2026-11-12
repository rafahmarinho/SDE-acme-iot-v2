---
name: t145-no-client-side-authz-mobile
description: Never trust role or permission state held in the React Native app; device control and admin actions are authorized server-side.
---

# T145: Avoid client-side authorization for mobile clients

**Category:** CODE_FIX
**SD Elements:** [T145](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T145/)
**Priority:** 8

**Spec Context:**
> "...consultar leituras, mudar a temperatura e ligar ou desligar tomadas." (...view readings, change temperature and turn plugs on or off.)
> Source: specs/PRD.md, L29-31
> "Tenha perfis de proprietário, administrador, operador e visualizador." (Owner, admin, operator, viewer roles.)
> Source: specs/PRD.md, L39

**What the spec implies (naive approach):**
The app stores `role` in Zustand/AsyncStorage and sends `{ role: 'operator' }` or decides locally whether a viewer can toggle a plug; a modified APK or proxy bypasses it.

**Secure Implementation Pattern:**
```ts
// apps/api/api/devices/[id]/command.ts
export default withErrors(async (req, res) => {
  const deviceId = DeviceIdSchema.parse(req.query.id);
  const device = await getDeviceOr404(deviceId);              // org_id from DB, not client
  await requireRole(req, device.org_id, ['owner', 'admin', 'operator']); // viewer denied
  const cmd = CommandSchema.parse(req.body);                   // setpoint range, plug on/off
  await setDesiredState(device.id, cmd);
  res.status(202).json({ accepted: true });
});
```

**Implementation Guidance:**
- Ignore any role/org fields in request bodies; derive from JWT + `memberships`.
- Treat the app binary as attacker-controlled (decompilable, modifiable).
- Return 403 consistently; UI disables controls only as UX.

**Success Criteria:**
- [ ] No API accepts role/permission claims from the client
- [ ] Viewer cannot change setpoint or plug state via direct API call

**Status:** Pending
