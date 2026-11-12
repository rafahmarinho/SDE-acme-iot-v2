---
name: t148-avoid-caching-confidential-data-on-client
description: Limit the ACME IoT offline read cache to non-confidential, last-known device readings; never persist tokens, team PII or integration secrets in plain client caches, and clear the cache on logout.
---

# T148: Avoid caching confidential data on client

**Category:** CODE_FIX
**SD Elements:** [T148](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T148/)
**Priority:** 7

**Spec Context:**
> "No celular, adapte os formulários ao toque, pause as atualizações em segundo plano e mostre os últimos dados como leitura offline." (On mobile, adapt forms to touch, pause updates in the background and show the latest data as offline read-only.)
> Source: specs/PRD.md, lines 51-53

**What the spec implies (naive approach):**
Dump every API/Supabase response (devices, team members, integrations, events) into AsyncStorage / localStorage so
"the latest data" is available offline, and never clean it up.

**Secure Implementation Pattern:**
```typescript
// apps/mobile/src/services/offlineCache.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

// Allow-list: only these non-confidential projections may be cached.
type CachedReading = { deviceId: string; type: string; value: number; unit: string; reportedAt: string };
const CACHE_KEY = (orgId: string) => `acme:readings:v1:${orgId}`;

export async function cacheReadings(orgId: string, rows: CachedReading[]) {
  const safe = rows.map(({ deviceId, type, value, unit, reportedAt }) => ({ deviceId, type, value, unit, reportedAt }));
  await AsyncStorage.setItem(CACHE_KEY(orgId), JSON.stringify({ savedAt: Date.now(), rows: safe }));
}

export async function clearOfflineCache() {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('acme:'));
  await AsyncStorage.multiRemove(keys);
}
// Call clearOfflineCache() from the logout handler and on SIGNED_OUT auth events.
```

**Implementation Guidance:**
- Classify data: readings/device state = cacheable; access tokens, team emails, integration credentials, firmware URLs = never cached in AsyncStorage/localStorage (tokens go to expo-secure-store, see T270/T2133).
- Store only explicit projections (allow-list fields), never raw API payloads.
- Expire cached data (e.g., 24h `savedAt` TTL) and scope keys by organization so org switches don't leak data.
- Clear cache on logout, on session-invalid errors and on org membership removal.
- Do not write temporary export files to shared/external storage; keep everything in the app sandbox.

**Success Criteria:**
- [x] Offline cache stores only allow-listed reading/state fields
- [ ] No tokens or PII present in AsyncStorage/localStorage (verified by inspecting storage after login)
- [x] Cache cleared on logout and expired after TTL

**Status:** Applied
