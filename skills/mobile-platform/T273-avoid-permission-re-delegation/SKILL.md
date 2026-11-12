---
name: t273-avoid-permission-re-delegation
description: Prevent permission re-delegation in the ACME IoT Android app - external intents/deep links must not use the app's camera/network/session privileges on a caller's behalf; keep components unexported.
---

# T273: Avoid permission re-delegation by considering caller's permissions when handling external requests

**Category:** CODE_FIX
**SD Elements:** [T273](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T273/)
**Priority:** 8

**Spec Context:**
> "para Android, iOS e web" (for Android, iOS and web) — Source: specs/PRD.md, line 19
> "cadastrar dispositivos por QR code" (register devices by QR code — requires CAMERA permission) — Source: specs/PRD.md, lines 27-29
> "ações de controle exigem conexão" (control actions require connectivity) — Source: specs/PRD.md, line 55

**What the spec implies (naive approach):**
Expose an intent/deep link such as "toggle plug" or "scan and register" that another installed app can fire, making
ACME IoT perform actions with its own permissions and the user's logged-in session.

**Secure Implementation Pattern:**
```json
// apps/mobile/app.json (excerpt)
{
  "expo": {
    "android": {
      "permissions": ["CAMERA"],
      "blockedPermissions": ["android.permission.READ_EXTERNAL_STORAGE", "android.permission.SYSTEM_ALERT_WINDOW"],
      "intentFilters": []
    }
  }
}
```
```typescript
// Any external entry point only navigates; state change requires in-app confirmation by the user
if (incoming.source === 'external') router.replace({ pathname: '/devices/[id]', params: { id } });
```

**Implementation Guidance:**
- List all permissions the app holds (CAMERA, INTERNET, notifications) and ensure none is exercised for an external caller.
- No exported activities/services/receivers/providers other than the launcher (verify merged manifest after `expo prebuild`).
- External links/intents never perform privileged actions (control, registration, firmware) directly — see T170.
- If a native module ever exposes a component, enforce `android:permission` with signature protection level and check `Binder.getCallingUid()`.

**Success Criteria:**
- [ ] Merged AndroidManifest has no unintended exported components
- [ ] No external intent triggers a privileged action without user confirmation
- [ ] Only required permissions declared

**Status:** Pending
