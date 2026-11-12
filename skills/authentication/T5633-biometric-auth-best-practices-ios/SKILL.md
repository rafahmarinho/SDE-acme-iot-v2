---
name: t5633-biometric-auth-best-practices-ios
description: If biometric unlock is added to the iOS app, implement it with expo-local-authentication bound to Keychain items, with fallback, never as the sole server credential.
---

# T5633: Implement best practices for Biometric authentication (iOS)

**Category:** CODE_FIX
**SD Elements:** [T5633](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T5633/)
**Priority:** 7

**Spec Context:**
> "Inclua as versões Android e iOS..." (Include Android and iOS versions...)
> Source: specs/PRD.md, L59
> "...ações de controle exigem conexão." (...control actions require connection.)
> Source: specs/PRD.md, L53-55

**What the spec implies (naive approach):**
Adding "unlock with Face ID" as a boolean gate in JS (`if (await authenticateAsync()) showApp()`), which can be bypassed on a compromised device and leaves the token unprotected.

**Secure Implementation Pattern:**
```ts
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

// Store refresh token behind biometrics (Keychain access control).
await SecureStore.setItemAsync('refresh', token, {
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
});

export async function unlockForSensitiveAction(reason: string) {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: reason, fallbackLabel: 'Use passcode', disableDeviceFallback: false,
  });
  if (!res.success) throw new Error('Authentication cancelled');
}
```

**Implementation Guidance:**
- Optional feature: only implement if biometric unlock is added; server auth stays Supabase email/password.
- Use biometrics to release a Keychain-stored secret, not as a JS boolean.
- Require biometrics for sensitive actions (firmware rollout, role changes, data reset) if enabled.
- Declare `NSFaceIDUsageDescription` in app.json (ios.infoPlist).

**Success Criteria:**
- [ ] Biometric gate releases a Keychain item with access control (not a boolean check)
- [ ] Passcode fallback works; feature can be disabled in settings

**Status:** Pending
