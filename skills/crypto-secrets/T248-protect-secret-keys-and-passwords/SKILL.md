---
name: t248-protect-secret-keys-and-passwords
description: Store server keys (Supabase service role, firmware signing key, device simulator secrets) only in Vercel encrypted env vars with least-privilege access, separate from client config, and rotate them.
---

# T248: Protect secret keys and passwords in the application

**Category:** CODE_FIX
**SD Elements:** [T248](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T248/)
**Priority:** 8

**Spec Context:**
> "As versões web e mobile devem compartilhar o mesmo projeto Supabase."
> (The web and mobile versions must share the same Supabase project.)
> Source: specs/PRD.md, lines 47-49
> "...um README com os passos para rodar e publicar a versão web e a API na Vercel." — lines 57-59

**What the spec implies (naive approach):**
Sharing "the same Supabase project" tempts developers to give the web/mobile client the service role
key, or keep all keys in a single `.env` used by every package.

**Secure Implementation Pattern:**
```ts
// apps/api/src/lib/supabaseAdmin.ts — server only, never imported by apps/mobile
import 'server-only'; // or an ESLint boundary rule
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export const supabaseAdmin = createClient(env.supabaseUrl, env.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```
```jsonc
// .eslintrc (apps/mobile) — forbid server modules in the client bundle
{ "rules": { "no-restricted-imports": ["error", { "patterns": ["**/apps/api/**", "*supabaseAdmin*"] }] } }
```

**Implementation Guidance:**
- Client gets only the anon key; all privileged work goes through the Vercel API.
- Mark Vercel env vars as "Sensitive"; restrict project access to admins.
- Keep firmware signing private key separate from the verification public key.
- Document rotation steps (service role, device secrets, signing key) in the README.
- Never log env values; redact `Authorization` headers in logs.

**Success Criteria:**
- [ ] Service role key referenced only under `apps/api/src/lib`.
- [ ] ESLint boundary prevents importing server modules into `apps/mobile`.
- [ ] Rotation procedure documented.
- [ ] Logs contain no secrets.

**Status:** Pending
