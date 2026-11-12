---
name: t164-clear-client-session-on-logout
description: Remove session tokens and cached org/device data from the Expo client on logout, session error or expiry.
---

# T164: Clear session information from client upon logout

**Category:** CODE_FIX
**SD Elements:** [T164](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T164/)
**Priority:** 7

**Spec Context:**
> "...pause as atualizações em segundo plano e mostre os últimos dados como leitura offline." (...pause background updates and show the latest data as offline reading.)
> Source: specs/PRD.md, L51-53

**What the spec implies (naive approach):**
Logout only navigates to the login screen; Supabase session in AsyncStorage, the offline readings cache, React Query cache and Realtime channels remain on the device.

**Secure Implementation Pattern:**
```ts
// apps/mobile/src/services/session.ts
export async function logout(reason: 'user' | 'expired' | 'invalid' = 'user') {
  await supabase.removeAllChannels();          // stop Realtime
  await supabase.auth.signOut({ scope: 'local' });
  queryClient.clear();                          // in-memory cache
  await offlineCache.wipe();                    // persisted readings (see T148)
  await SecureStore.deleteItemAsync('session'); // native token storage
  router.replace({ pathname: '/login', params: { reason } });
}
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESH_FAILED' as any) void logout('expired');
});
```

**Implementation Guidance:**
- Call the same cleanup on explicit logout, 401 from the API, and refresh failure.
- Clear org/building selection, last viewed devices, push token association (if added).
- On web, combine with `Clear-Site-Data` (T1539).

**Success Criteria:**
- [ ] After logout no token, cached readings or org data remain in storage
- [ ] 401/refresh failure triggers the same cleanup
- [ ] Realtime subscriptions closed on logout

**Status:** Pending
