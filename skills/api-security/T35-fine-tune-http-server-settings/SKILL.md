---
name: t35-fine-tune-http-server-settings
description: HTTP server limits (header count/size, timeouts, connection limits) for the ACME IoT API are governed by the Vercel serverless platform rather than application code; document platform settings and owner.
---

### Task T35: Fine-tune HTTP server settings (NON-CODE)

**Category:** INFRA
**SD Elements:** [T35](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T35/)
**Priority:** 9

**Guidance:** Set limits on incoming HTTP messages (number/length of headers, body size, URI length,
timeouts, concurrent connections) and notify administrators of violations.

**Why Not Code-Fixable:**
- Searched specs: specs/PRD.md lines 17-19 ("uma API TypeScript na Vercel") and lines 57-59
  ("publicar a versão web e a API na Vercel").
- Found: the API runs as Vercel serverless functions; no self-hosted HTTP server (NGINX/Apache/Node server) is described.
- Missing: there is no server process whose header/connection/timeout settings the application controls.
- Conclusion: server-level limits are enforced by the Vercel edge/runtime (request header and body
  limits, function `maxDuration`). Application-level body limits are covered by T536.

**Recommended Action:**
- Platform owner sets `maxDuration` and memory per function in `vercel.json`, reviews Vercel's documented
  request limits, and enables Vercel Firewall / attack challenge mode for abuse.
- Configure log drains/alerts for 413/431/504 spikes so administrators are notified.

**Re-evaluation (apply-fixes):** an applicable config file exists in the repo, so the in-repo part was applied:
- `apps/api/vercel.json`: per-function `maxDuration` (10 s; 20 s for firmware) and `memory` limits; baseline security headers.
- `apps/api/src/lib/http.ts`: URL length ≤ 2048 (414), ≤ 64 headers / 16 KiB of headers (431), per-route body limits (413),
  method allow-list (405), all violations logged with requestId.
- Remaining platform-only items (connection limits, edge header limits, firewall/attack mode, log-drain alerts) stay with the platform owner as described above.

**Status:** Applied
