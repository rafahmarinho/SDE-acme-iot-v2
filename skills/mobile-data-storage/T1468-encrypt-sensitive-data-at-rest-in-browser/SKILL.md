---
name: t1468-encrypt-sensitive-data-at-rest-in-browser
description: For the ACME IoT web build, avoid browser storage for sensitive data; if the offline read cache or session must live in the browser, minimize it and encrypt sensitive entries with WebCrypto AES-GCM.
---

# T1468: Encrypt sensitive data at rest in the browser

**Category:** CODE_FIX
**SD Elements:** [T1468](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T1468/)
**Priority:** 9

**Spec Context:**
> "Os resultados devem aparecer nas telas e continuar salvos após recarregar a aplicação. As versões web e mobile devem compartilhar o mesmo projeto Supabase." (Results must appear on screens and stay saved after reloading the app. Web and mobile versions must share the same Supabase project.)
> Source: specs/PRD.md, lines 45-49

**What the spec implies (naive approach):**
Persist the Supabase session and the full org dataset in `localStorage` so the web app "stays saved after reload".

**Secure Implementation Pattern:**
```typescript
// apps/mobile/src/services/webVault.ts (web only)
// Non-extractable AES-GCM key kept in IndexedDB; ciphertext stored instead of plaintext.
async function getKey(): Promise<CryptoKey> {
  const existing = await idbGet<CryptoKey>('acme-key');
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await idbSet('acme-key', key);
  return key;
}
export async function sealJSON(value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getKey(), new TextEncoder().encode(JSON.stringify(value)));
  return JSON.stringify({ iv: Array.from(iv), ct: Array.from(new Uint8Array(ct)) });
}
```

**Implementation Guidance:**
- "Saved after reload" is satisfied by Supabase (server persistence) — do not replicate the dataset in the browser.
- Keep browser-side data to the minimum: session + small last-known readings cache.
- Prefer short access-token lifetimes; refresh tokens rotate (Supabase default) and are revoked on logout.
- Encrypt any sensitive cached entries with WebCrypto (key non-extractable); wipe key + data on logout (see T1539).
- Never store team member PII, integration secrets or firmware links in localStorage.
- Note: XSS defeats browser encryption — pair with CSP/XSS controls (T36, T37).

**Success Criteria:**
- [ ] No sensitive plaintext in localStorage/sessionStorage/IndexedDB after login
- [ ] Browser cache limited to session + minimal readings
- [ ] Encryption key and data wiped on logout

**Status:** Pending
