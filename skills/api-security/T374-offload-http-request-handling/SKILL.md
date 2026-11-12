---
name: t374-offload-http-request-handling
description: Offloading HTTP request buffering and resource-exhaustion protection to OS/server modules is handled by Vercel's edge network for the ACME IoT API; document platform protections.
---

### Task T374: Offload HTTP request handling to dedicated modules (NON-CODE)

**Category:** INFRA
**SD Elements:** [T374](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T374/)
**Priority:** 7

**Guidance:** Offload request handling (e.g. full-request buffering before dispatch) to the OS or
dedicated server modules, and configure firewall/QoS/security modules to resist resource exhaustion
(slowloris, connection floods).

**Why Not Code-Fixable:**
- Searched specs: specs/PRD.md lines 17-19 and 57-59 (API hosted on Vercel), line 37 (HTTP services
  for device simulation).
- Found: the only HTTP entry points are Vercel serverless functions and Supabase managed endpoints.
- Missing: no web server, socket listener, or reverse proxy under the application's control.
- Conclusion: request buffering, connection management and L7 DoS protection are provided by
  Vercel's edge network and Supabase's managed gateway — INFRA.

**Recommended Action:**
- Platform owner enables Vercel Firewall rules (rate limiting / bot protection) for `/api/*` and
  verifies Supabase network restrictions; application-level throttling remains in T1362.

**Re-evaluation (apply-fixes):** checked apps/api/vercel.json, apps/api/src/lib/http.ts and the whole repo for a server/proxy config.
NONE - no file in this repository can implement this fix: Vercel buffers the full request at its edge before invoking a
function and owns socket/connection handling; Vercel Firewall/WAF rules and Supabase network restrictions are configured
in their dashboards, not in vercel.json. Application-level mitigations (body/header limits, per-user/IP throttling) are
already applied under T35, T536 and T1362.

**Status:** Documented
