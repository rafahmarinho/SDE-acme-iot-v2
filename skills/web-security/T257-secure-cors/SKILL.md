---
name: t257-secure-cors
description: Strict CORS allow-list for the Vercel API serving the Expo web build; never reflect arbitrary origins or rely on Origin for access control.
---

# T257: Secure cross origin resource sharing (CORS)

**Category:** CODE_FIX
**SD Elements:** [T257](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T257/)
**Priority:** 8

**Spec Context:**
> "...publicar a versão web e a API na Vercel." (...publish the web version and the API on Vercel.)
> Source: specs/PRD.md, L57-59
> "As versões web e mobile devem compartilhar o mesmo projeto Supabase." (Web and mobile share the same Supabase project.)
> Source: specs/PRD.md, L47-49

**What the spec implies (naive approach):**
Web app and API on different Vercel domains, "fixed" with `Access-Control-Allow-Origin: *` or by echoing the request `Origin` with credentials.

**Secure Implementation Pattern:**
```ts
// apps/api/src/middleware/cors.ts
const ALLOWED = new Set((process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean));
export function cors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin;
  if (origin && ALLOWED.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false; // auth still enforced by requireUser(), CORS is not access control
}
```

**Implementation Guidance:**
- Exact-match origins from env (prod web domain, explicit preview domains); no regex wildcards on `*.vercel.app`.
- No `Allow-Credentials` (bearer tokens are used).
- Native apps are unaffected by CORS; authorization must still be enforced.
- Configure Supabase Auth "Site URL"/redirect allow-list consistently.

**Success Criteria:**
- [x] Unknown origins receive no ACAO header
- [x] No `*` or reflected origin
- [x] All non-OPTIONS requests authenticated regardless of origin

**Status:** Applied
**Applied in:** apps/api/src/middleware/cors.ts (exact allow-list, no credentials), apps/api/src/lib/env.ts (ALLOWED_ORIGINS validated: https, no wildcards).
