---
name: t186-patch-third-party-libraries
description: Keep Expo SDK, React Native, Expo Router, supabase-js, Vercel runtime and all pnpm dependencies on current patched versions with secure settings, a committed lockfile and automated vulnerability scanning.
---

# T186: Use recommended settings and the latest patches for third party libraries and software

**Category:** CODE_FIX
**SD Elements:** [T186](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T186/)
**Priority:** 10

**Spec Context:**
> "Use versões atuais e estáveis das tecnologias e Supabase para PostgreSQL..."
> (Use current and stable versions of the technologies and Supabase for PostgreSQL...)
> Source: specs/PRD.md, line 5
> "...React Native com Expo, Expo Router e TypeScript... Use pnpm." — lines 17-19

**What the spec implies (naive approach):**
Picking versions once at scaffold time, using caret ranges without a lockfile, never revisiting
advisories, and leaving library defaults (e.g. Supabase Auth email confirmation off) unchanged.

**Secure Implementation Pattern:**
```jsonc
// package.json (root)
{
  "packageManager": "pnpm@9.12.0",
  "scripts": { "audit": "pnpm audit --prod --audit-level=high" },
  "pnpm": { "overrides": {} }   // pin patched transitive deps here when advisories appear
}
```
```yaml
# .github/dependabot.yml
version: 2
updates:
  - { package-ecosystem: npm, directory: "/", schedule: { interval: weekly }, open-pull-requests-limit: 10 }
```

**Implementation Guidance:**
- Commit `pnpm-lock.yaml`; CI uses `pnpm install --frozen-lockfile` and fails on high/critical `pnpm audit`.
- Upgrade Expo SDK on each stable release (`npx expo install --fix`); keep `@supabase/supabase-js` current.
- Review secure defaults: Supabase Auth (email confirmation, password length, rate limits), Expo
  `app.json` permissions minimal, Vercel Node runtime on supported LTS.
- Remove unused dependencies; avoid unmaintained packages.

**Success Criteria:**
- [ ] Lockfile committed; CI uses frozen lockfile.
- [ ] Automated dependency update PRs enabled.
- [ ] CI blocks on high/critical advisories.
- [ ] Secure library configuration reviewed and documented.

**Status:** Pending
