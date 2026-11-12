---
name: t29-anti-csrf-tokens
description: Prevent CSRF on the Vercel API used by the Expo web build - bearer-token auth only, no ambient cookies, or anti-CSRF tokens if cookies are introduced.
---

# T29: Use anti-Cross-Site Request Forgery (CSRF) tokens

**Category:** CODE_FIX
**SD Elements:** [T29](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T29/)
**Priority:** 7

**Spec Context:**
> "...para Android, iOS e web, com uma API TypeScript na Vercel." (...for Android, iOS and web, with a TypeScript API on Vercel.)
> Source: specs/PRD.md, L19
> "...mudar a temperatura e ligar ou desligar tomadas." (...change temperature and turn plugs on/off.)
> Source: specs/PRD.md, L29-31

**What the spec implies (naive approach):**
Storing the session in a cookie for the web version so the API "just works", making state-changing routes (plug on/off, reset data) callable from any malicious site.

**Secure Implementation Pattern:**
```ts
// apps/api/src/middleware/auth.ts — accept ONLY Authorization header, never cookies
const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
if (!token) throw new HttpError(401);

// Reject state-changing requests without JSON content type (blocks simple form posts)
if (req.method !== 'GET' && !req.headers['content-type']?.startsWith('application/json'))
  throw new HttpError(415);

// IF cookies are ever used (e.g. SSR): double-submit token
if (req.cookies?.session && req.headers['x-csrf-token'] !== req.cookies['csrf']) throw new HttpError(403);
```

**Implementation Guidance:**
- Keep Supabase session in storage and send `Authorization: Bearer` from the client.
- GET routes must be side-effect free.
- If cookies are introduced: `SameSite=Strict`, `Secure`, `HttpOnly`, plus CSRF token per session.
- Combine with strict CORS (T257).

**Success Criteria:**
- [x] API ignores cookies for authentication
- [ ] No state change on GET
- [x] Cross-site form POST to any mutation route fails

**Status:** Applied
**Applied in:** apps/api/src/middleware/auth.ts (Bearer-only, cookie auth refused), apps/api/src/lib/http.ts (415 unless application/json; bodies rejected on GET/DELETE).
