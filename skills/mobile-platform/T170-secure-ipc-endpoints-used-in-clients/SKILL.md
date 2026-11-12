---
name: t170-secure-ipc-endpoints-used-in-clients
description: Secure ACME IoT client IPC entry points - the acmeiot:// deep-link scheme, Expo Router routes reachable via links, and QR payloads must be validated and must never trigger state-changing actions without user confirmation.
---

# T170: Secure IPC endpoints used in clients

**Category:** CODE_FIX
**SD Elements:** [T170](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T170/)
**Priority:** 7

**Spec Context:**
> "React Native com Expo, Expo Router e TypeScript" (React Native with Expo, Expo Router and TypeScript) — Source: specs/PRD.md, line 17
> "Permita cadastrar dispositivos por QR code ou código manual ... mudar a temperatura e ligar ou desligar tomadas" (register devices by QR/manual code ... change temperature and turn plugs on/off) — Source: specs/PRD.md, lines 27-31

Expo Router exposes every screen as a deep link (`acmeiot://devices/123`), and password recovery returns via a link.

**What the spec implies (naive approach):**
Accept any deep link/QR content and act on query params, e.g. `acmeiot://devices/123/command?power=off` toggles a plug,
or a recovery link with an attacker-supplied redirect is followed.

**Secure Implementation Pattern:**
```typescript
// apps/mobile/app/+native-intent.tsx - filter incoming links before routing
const ALLOWED = [/^\/devices\/[0-9a-f-]{36}$/, /^\/devices\/new$/, /^\/reset-password$/];
export function redirectSystemPath({ path }: { path: string }) {
  const url = new URL(path, 'acmeiot://app');
  if (!ALLOWED.some((re) => re.test(url.pathname))) return '/';
  return url.pathname; // drop query params; screens fetch data by id and require auth
}
// QR payload: parse strictly, never execute actions from it
const QrPayload = z.object({ v: z.literal(1), claimCode: z.string().regex(/^[A-Z2-9]{12}$/) });
```

**Implementation Guidance:**
- Keep a single custom scheme; prefer verified Universal Links/App Links for the auth redirect.
- Allow-list deep-link paths; strip params; require an authenticated session for app routes.
- Deep links and QR scans only navigate/prefill; control actions require explicit in-app confirmation and server authorization.
- Validate recovery-link redirect URLs against Supabase allowed redirect list.
- Do not export Android activities/receivers beyond the main launcher (see T5646).

**Success Criteria:**
- [ ] Unknown deep-link paths redirect to home
- [ ] No deep link or QR can change device state without confirmation
- [ ] QR payloads validated by a strict schema

**Status:** Pending
