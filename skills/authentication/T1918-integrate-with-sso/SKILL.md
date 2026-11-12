---
name: t1918-integrate-with-sso
description: SSO integration requires an external identity provider not described in the PRD (email/password only); documented as infrastructure decision.
---

# Task T1918: Integrate with SSO (NON-CODE)

**Category:** INFRA
**SD Elements:** [T1918](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T1918/)
**Priority:** 9

**Guidance:** For SSO integrations: verify the identity directory, use modern protocols (OIDC/SAML), secure all SSO components, require MFA, enforce session timeouts, and restrict devices allowed to use SSO.

**Why Not Code-Fixable:**
- Searched specs: specs/PRD.md L5-7 (auth), L11 (login screens), L39 (roles), L25 (integrations).
- Found: "login por e-mail e senha" (email and password login) via Supabase Auth only.
- Missing: no identity provider (Okta, Entra ID, Google Workspace), no SAML/OIDC requirement, no corporate directory.
- Conclusion: SSO depends on selecting and configuring an external IdP and Supabase Auth SSO (SAML) at the platform level; nothing to implement in app code until that decision is made.

**Recommended Action:** Product/security owner decides whether enterprise customers require SSO. If yes: configure Supabase Auth SAML SSO with the customer IdP, require MFA at the IdP, map IdP groups to org roles (owner/admin/operator/viewer), set session timeouts, and then add an "Sign in with SSO" button (domain-based) in the login screen.

**Status:** Documented
