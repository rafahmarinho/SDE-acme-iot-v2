---
name: t5634-securely-integrate-icloud-storage-ios
description: ACME IoT must not sync sensitive data to iCloud - keep Keychain items device-only, exclude offline caches from iCloud backup, and do not add iCloud entitlements unless a reviewed need exists.
---

# T5634: Securely integrate iCloud storage into iOS applications (iOS)

**Category:** CODE_FIX
**SD Elements:** [T5634](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T5634/)
**Priority:** 9

**Spec Context:**
> "As versões web e mobile devem compartilhar o mesmo projeto Supabase." (Web and mobile must share the same Supabase project.) — Source: specs/PRD.md, lines 47-49
> "mostre os últimos dados como leitura offline" (show the latest data as offline read) — Source: specs/PRD.md, line 53

The PRD uses Supabase as the single sync backend; iCloud is not required. The risk is accidental iCloud sync/backup
of the session or offline cache on iOS.

**What the spec implies (naive approach):**
Rely on default iOS behaviour: files in Documents are backed up to iCloud, Keychain items may sync via iCloud Keychain,
or a developer adds `NSUbiquitousKeyValueStore` to "sync settings across devices".

**Secure Implementation Pattern:**
```typescript
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';

// Device-only keychain items never sync to iCloud Keychain
await SecureStore.setItemAsync('sb-session', s, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });

// Offline cache lives in cacheDirectory (Library/Caches) - not included in iCloud backups
const CACHE_FILE = `${FileSystem.cacheDirectory}acme-readings.json`;
```

**Implementation Guidance:**
- Do NOT add iCloud/CloudKit entitlements (`ios.usesIcloudStorage`) to app.json; Supabase is the system of record.
- Use `*_THIS_DEVICE_ONLY` keychain accessibility for all secrets.
- Put offline caches in `cacheDirectory`, not `documentDirectory`, so they are excluded from iCloud backup.
- If iCloud is ever added (e.g., user preferences), store only non-sensitive key/values, encrypt anything else, and handle sync conflicts/account changes.

**Success Criteria:**
- [x] No iCloud entitlements in the iOS build (unless reviewed)
- [x] All Keychain items use device-only accessibility
- [x] Offline cache stored outside backed-up directories

**Status:** Applied
