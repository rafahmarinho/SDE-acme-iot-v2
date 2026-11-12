---
name: t146-encrypt-mobile-network-communications
description: Enforce encrypted network traffic in the Expo Android/iOS builds (no cleartext traffic, ATS enabled) for Supabase, Realtime and the Vercel API.
---

# T146: Use encryption for network communications in mobile environments

**Category:** CODE_FIX
**SD Elements:** [T146](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T146/)
**Priority:** 8

**Spec Context:**
> "No celular, adapte os formulários ao toque, pause as atualizações em segundo plano e mostre os últimos dados como leitura offline. Retome as atualizações quando a conexão voltar..."
> (On the phone, adapt forms to touch, pause updates in background, show latest data as offline reading. Resume updates when the connection returns...)
> Source: specs/PRD.md, lines 49-55

**What the spec implies (naive approach):**
Phones switch between untrusted Wi-Fi and cellular networks while reconnecting; enabling
`usesCleartextTraffic` or ATS exceptions "to make local dev work" leaks tokens and readings.

**Secure Implementation Pattern:**
```ts
// apps/mobile/app.config.ts
export default ({ config }) => ({
  ...config,
  ios: { ...config.ios, infoPlist: { NSAppTransportSecurity: { NSAllowsArbitraryLoads: false } } },
  android: { ...config.android },
  plugins: [
    ['expo-build-properties', { android: { usesCleartextTraffic: false } }],
  ],
});

// apps/mobile/src/services/api.ts
export async function apiFetch(path: string, init: RequestInit = {}) {
  const url = new URL(path, API_BASE_URL); // API_BASE_URL validated as https (T21)
  if (url.protocol !== 'https:') throw new Error('Insecure transport blocked');
  return fetch(url, init);
}
```

**Implementation Guidance:**
- `usesCleartextTraffic: false` and no ATS exceptions in production profiles (`eas.json`).
- Use a separate dev profile if cleartext localhost is needed; never ship it.
- On reconnect (PRD), re-establish Realtime via `wss://` only.
- Do not send tokens in URL query strings (logged by proxies).

**Success Criteria:**
- [x] Production Android manifest has `usesCleartextTraffic="false"`.
- [x] iOS Info.plist has no `NSAllowsArbitraryLoads=true`.
- [x] All app network calls use `https://`/`wss://`.

**Status:** Applied
