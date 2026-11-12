---
name: t66-prevent-framing
description: Deny framing of the Expo web app and API responses with CSP frame-ancestors and X-Frame-Options headers on Vercel to prevent clickjacking.
---

# T66: Prevent web pages from being loaded inside iFrame

**Category:** CODE_FIX
**SD Elements:** [T66](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T66/)
**Priority:** 7

**Spec Context:**
> "...um README com os passos para rodar e publicar a versão web e a API na Vercel." (...a README with steps to run and publish the web version and the API on Vercel.)
> Source: specs/PRD.md, L57-59
> "...ligar ou desligar tomadas." (...turn plugs on or off.)
> Source: specs/PRD.md, L29-31

**What the spec implies (naive approach):**
Deploying the static Expo web export to Vercel with default headers, so an attacker can frame the dashboard and trick an operator into clicking "turn off" or "rollback firmware".

**Secure Implementation Pattern:**
```json
// vercel.json (web project) and apps/api/vercel.json
{
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://<api>.vercel.app; img-src 'self' data: blob:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
    ]
  }]
}
```

**Implementation Guidance:**
- Apply headers to both the web deployment and the API project.
- Adjust `connect-src` to actual Supabase project and API host; test 3D view (WebGL needs `blob:` for workers/textures).
- Do not rely on JS frame-busting.

**Success Criteria:**
- [ ] `frame-ancestors 'none'` and `X-Frame-Options: DENY` present on all responses
- [ ] App fails to render inside a third-party iframe

**Status:** Pending
