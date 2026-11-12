---
name: t166-protect-against-json-hijacking
description: Protect JSON endpoints of the Vercel API (devices, readings, events) from JSON hijacking - object-wrapped responses, auth headers, correct content types.
---

# T166: Protect against JSON hijacking

**Category:** CODE_FIX
**SD Elements:** [T166](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T166/)
**Priority:** 7

**Spec Context:**
> "...com uma API TypeScript na Vercel." (...with a TypeScript API on Vercel.)
> Source: specs/PRD.md, L19
> "...consultar leituras..." (...view readings...)
> Source: specs/PRD.md, L29

**What the spec implies (naive approach):**
`GET /api/devices` returning a top-level JSON array authenticated by a cookie, loadable cross-site via `<script src>` in older browsers.

**Secure Implementation Pattern:**
```ts
// apps/api/src/lib/respond.ts
export function json(res: VercelResponse, status: number, data: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify({ data }));   // always wrap in an object
}
// GET /api/devices -> { "data": [ ... ], "nextCursor": "..." }
```

**Implementation Guidance:**
- Never return top-level arrays; wrap in `{ data }`.
- Authenticate with `Authorization` header only (T29) so cross-site script includes carry no credentials.
- Sensitive JSON responses: `Cache-Control: no-store`.

**Success Criteria:**
- [ ] All JSON responses are objects with `application/json` + `nosniff`
- [ ] No cookie-based auth on JSON endpoints

**Status:** Pending
