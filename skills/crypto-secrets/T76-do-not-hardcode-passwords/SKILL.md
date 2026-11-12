---
name: t76-do-not-hardcode-passwords
description: Keep the Supabase service role key, device simulator secrets, firmware signing keys and demo account passwords out of source code and out of the Expo bundle; load them from Vercel/EAS environment variables.
---

# T76: Do not hardcode passwords

**Category:** CODE_FIX
**SD Elements:** [T76](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T76/)
**Priority:** 10

**Spec Context:**
> "Entregue o código completo, configuração do banco, dados iniciais, exemplos de variáveis de ambiente..."
> (Deliver the complete code, database configuration, seed data, environment variable examples...)
> Source: specs/PRD.md, lines 55-57
> "Prepare dados de demonstração com duas organizações e vinte dispositivos." (demo data, two orgs, twenty devices) — line 43

**What the spec implies (naive approach):**
Shipping seed users with a shared password like `Password123` in `seed.sql`, pasting the Supabase
service role key into `supabase.ts`, or committing a populated `.env`.

**Secure Implementation Pattern:**
```ts
// apps/api/src/lib/env.ts
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}
export const env = {
  supabaseUrl: required('SUPABASE_URL'),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'), // server-only, set in Vercel
  deviceSimSecret: required('DEVICE_SIM_SHARED_SECRET'),
};
```
```sql
-- supabase/seed.sql: create demo users WITHOUT passwords; invite via magic link / reset flow
-- or create them from a one-off admin script reading DEMO_USER_PASSWORD from the environment.
```

**Implementation Guidance:**
- Only `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_BASE_URL` may be `EXPO_PUBLIC_*`.
- `.env` is git-ignored; `.env.example` contains placeholders only.
- Add secret scanning (gitleaks / GitHub secret scanning) in CI.
- Demo accounts: generate random passwords at seed time or use password-reset onboarding.

**Success Criteria:**
- [x] `git grep -iE "service_role|password\s*=|secret\s*="` finds no literal secrets.
- [ ] Expo web/native bundle contains no service role key (inspect exported bundle).
- [ ] Seed data contains no fixed shared passwords.
- [x] Secret scanning runs in CI.

**Status:** Applied
**Applied in:** apps/api/src/lib/env.ts (all secrets from env, placeholder values rejected), .env.example (placeholders only), .gitignore (.env*, *.pem, keystores), .github/workflows/security.yml (gitleaks). Seed passwords: Layer A.
