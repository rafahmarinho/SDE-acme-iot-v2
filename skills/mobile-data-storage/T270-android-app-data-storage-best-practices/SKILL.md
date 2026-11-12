---
name: t270-android-app-data-storage-best-practices
description: Store ACME IoT data securely on Android - Supabase session in expo-secure-store (Android Keystore), private app storage only, no external storage, and backups disabled for sensitive data.
---

# T270: Follow best practices for storing application data on Android devices

**Category:** CODE_FIX
**SD Elements:** [T270](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T270/)
**Priority:** 7

**Spec Context:**
> "React Native com Expo, Expo Router e TypeScript para Android, iOS e web" (React Native with Expo, Expo Router and TypeScript for Android, iOS and web)
> Source: specs/PRD.md, lines 17-19
> "login por e-mail e senha" (email and password login) — Source: specs/PRD.md, lines 5-7
> "mostre os últimos dados como leitura offline" (show the latest data as offline read) — Source: specs/PRD.md, line 53

**What the spec implies (naive approach):**
Use the Supabase JS default (AsyncStorage, plain SQLite file) for the auth session and offline data, and leave
`android:allowBackup` at its default so tokens end up in cloud/adb backups.

**Secure Implementation Pattern:**
```typescript
// apps/mobile/src/services/supabase.ts
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const secureStorage = {
  getItem: (k: string) => SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  removeItem: (k: string) => SecureStore.deleteItemAsync(k),
};

export const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { storage: Platform.OS === 'web' ? undefined : secureStorage, persistSession: true, autoRefreshToken: true },
});
```
```json
// apps/mobile/app.json (excerpt)
{ "expo": { "android": { "allowBackup": false, "permissions": [] } } }
```

**Implementation Guidance:**
- Session/refresh tokens: expo-secure-store only (backed by Android Keystore). Note SecureStore's ~2KB value limit — chunk large sessions if necessary.
- Never request `READ/WRITE_EXTERNAL_STORAGE`; keep caches in the app's private directory (expo-file-system `documentDirectory`/`cacheDirectory`).
- Set `android.allowBackup: false` (or exclude secure prefs via backup rules in a config plugin).
- Do not relax file permissions or expose files via a FileProvider.
- Remove unused permissions from the generated manifest (`android.blockedPermissions`).

**Success Criteria:**
- [ ] Auth session persisted through expo-secure-store on Android
- [ ] No external storage permissions in the built AndroidManifest
- [ ] `allowBackup` disabled or sensitive data excluded from backups

**Status:** Pending
