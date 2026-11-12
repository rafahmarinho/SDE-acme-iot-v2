---
name: t2133-protect-the-security-of-data-in-ios
description: Protect ACME IoT data on iOS - credentials/tokens in the Keychain via expo-secure-store with device-only accessibility, data protection for files, and no sensitive data in UserDefaults or logs.
---

# T2133: Protect the security of data in iOS

**Category:** CODE_FIX
**SD Elements:** [T2133](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T2133/)
**Priority:** 8

**Spec Context:**
> "para Android, iOS e web" (for Android, iOS and web) — Source: specs/PRD.md, line 19
> "Inclua as versões Android e iOS e instruções para gerar os pacotes nativos." (Include the Android and iOS versions and instructions to build native packages.) — Source: specs/PRD.md, line 59
> "login por e-mail e senha" (email and password login) — Source: specs/PRD.md, lines 5-7

**What the spec implies (naive approach):**
Persist the session through AsyncStorage (plain files / NSUserDefaults-like storage) and cache readings in unprotected files.

**Secure Implementation Pattern:**
```typescript
import * as SecureStore from 'expo-secure-store';

// Keychain item, not synced to iCloud, unavailable while device is locked
export const iosSecureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
await SecureStore.setItemAsync('sb-session', sessionJson, iosSecureOptions);
```
```json
// apps/mobile/app.json (excerpt) - default file protection for app files
{ "expo": { "ios": { "entitlements": { "com.apple.developer.default-data-protection": "NSFileProtectionComplete" } } } }
```

**Implementation Guidance:**
- Store credentials/tokens only in the Keychain (expo-secure-store) with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- Enable Data Protection (`NSFileProtectionComplete`) for app files used by the offline cache.
- Use platform crypto (expo-crypto / WebCrypto) rather than custom algorithms (see T59/T60).
- Never log tokens, emails or device secrets (strip in production builds; see T49).
- Hide sensitive screens in the app switcher snapshot if they show PII (team, profile).

**Success Criteria:**
- [x] Session stored in Keychain with device-only accessibility
- [x] Data Protection entitlement set for the iOS build
- [x] No sensitive values in AsyncStorage or console logs on iOS

**Status:** Applied
