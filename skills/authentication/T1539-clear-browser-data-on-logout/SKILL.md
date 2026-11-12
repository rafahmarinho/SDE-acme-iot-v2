---
name: t1539-clear-browser-data-on-logout
description: Send the Clear-Site-Data header and wipe browser storage on logout for the Expo web build and Vercel API.
---

# T1539: Clear browser data on user logout

**Category:** CODE_FIX
**SD Elements:** [T1539](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T1539/)
**Priority:** 8

**Spec Context:**
> "...para Android, iOS e web..." (...for Android, iOS and web...)
> Source: specs/PRD.md, L19
> "Os resultados devem aparecer nas telas e continuar salvos após recarregar a aplicação." (Results must appear on screen and stay saved after reloading.)
> Source: specs/PRD.md, L45-47

**What the spec implies (naive approach):**
The web version keeps the Supabase session and cached data in localStorage/IndexedDB indefinitely to "stay saved after reload", even after logout on a shared browser.

**Secure Implementation Pattern:**
```ts
// apps/api/api/auth/logout.ts
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await requireUser(req);
  res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
  res.status(204).end();
}
// apps/mobile (web): after supabase.auth.signOut()
if (Platform.OS === 'web') {
  await fetch(`${API}/api/auth/logout`, { method: 'POST', headers: authHeader() });
  localStorage.clear(); sessionStorage.clear();
  indexedDB.databases?.().then(dbs => dbs.forEach(d => d.name && indexedDB.deleteDatabase(d.name)));
}
```

**Implementation Guidance:**
- "Stay saved after reload" refers to server-persisted data, not to keeping client caches after logout.
- Serve the logout route from the same origin as the web app (or proxy) so the header applies.
- Combine with T164 client cleanup.

**Success Criteria:**
- [x] Logout response includes `Clear-Site-Data`
- [x] localStorage/IndexedDB empty after logout in the web build

**Status:** Applied
