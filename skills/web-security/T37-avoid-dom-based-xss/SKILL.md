---
name: t37-avoid-dom-based-xss
description: Avoid DOM XSS in the Expo web build from URL params (Expo Router search params, deep links, QR payloads) flowing into unsafe sinks.
---

# T37: Avoid DOM-based Cross-Site Scripting (XSS)

**Category:** CODE_FIX
**SD Elements:** [T37](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T37/)
**Priority:** 8

**Spec Context:**
> "React Native com Expo, Expo Router e TypeScript para Android, iOS e web" (React Native with Expo, Expo Router and TypeScript for Android, iOS and web)
> Source: specs/PRD.md, L17-19
> "Permita cadastrar dispositivos por QR code ou código manual" (Allow registering devices via QR code or manual code)
> Source: specs/PRD.md, L27-29

**What the spec implies (naive approach):**
Reading `?redirect=` or `?q=` from Expo Router params, or the raw QR string, and passing it to `window.location`, `Linking.openURL`, `innerHTML` or `eval`-like sinks on web.

**Secure Implementation Pattern:**
```ts
import { useLocalSearchParams, router } from 'expo-router';

const { redirect } = useLocalSearchParams<{ redirect?: string }>();
// Only allow internal relative routes
const safe = typeof redirect === 'string' && /^\/(?!\/)[\w\-/[\]()]*$/.test(redirect) ? redirect : '/';
router.replace(safe);

// QR payload: parse into a strict schema; never open/eval it
const QrSchema = z.object({ v: z.literal(1), claim: z.string().regex(/^[A-Z0-9]{10,32}$/) });
const payload = QrSchema.safeParse(JSON.parse(raw));
```

**Implementation Guidance:**
- Never pass URL/QR data to `innerHTML`, `document.write`, `new Function`, `setTimeout(string)`, `Linking.openURL` without allow-listing.
- Lint rules: `no-eval`, `no-implied-eval`, `react/no-danger`.
- Enforce CSP with `script-src 'self'` on the web deployment (T66).

**Success Criteria:**
- [ ] Redirect params restricted to internal routes
- [ ] QR payload validated by schema before use
- [ ] No unsafe DOM sinks in web code (lint passes)

**Status:** Pending
