---
name: t178-obtain-consent-before-collecting-pi
description: Obtain separate, explicit consent in ACME IoT before collecting personal data that requires it (e.g., occupancy monitoring, marketing/notification emails), record consent versions, and gate processing on it.
---

# T178: Obtain consent from users prior to collecting personal information

**Category:** CODE_FIX
**SD Elements:** [T178](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T178/)
**Priority:** 10

**Spec Context:**
> "Inclua login, recuperação de senha, perfil, configurações" (Include login, password recovery, profile, settings) — Source: specs/PRD.md, line 11
> "sensores de temperatura, umidade e ocupação" (temperature, humidity and occupancy sensors) — Source: specs/PRD.md, line 27
> "histórico e notificações" (history and notifications) — Source: specs/PRD.md, line 33

**What the spec implies (naive approach):**
Collect profile data, occupancy history and send notification emails by default, with consent buried in terms.

**Secure Implementation Pattern:**
```sql
-- supabase/migrations: consent records
create table consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('occupancy_analytics','email_notifications')),
  policy_version text not null,
  granted boolean not null,
  created_at timestamptz not null default now()
);
alter table consents enable row level security;
create policy own_consents on consents for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```
```typescript
// Gate processing on latest consent
export async function hasConsent(userId: string, purpose: 'occupancy_analytics' | 'email_notifications') {
  const { data } = await db.from('consents').select('granted').eq('user_id', userId).eq('purpose', purpose)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data?.granted === true;
}
```

**Implementation Guidance:**
- Confirm with the privacy officer/PIA which purposes need consent; show a dedicated consent screen (separate from Terms) on first login and in Settings.
- Default unchecked; plain-language description per purpose; record policy version and timestamp.
- Gate collection/processing (occupancy analytics, email notifications) on `hasConsent`.
- Demo seed data uses fictitious people only.

**Success Criteria:**
- [x] Consent captured per purpose, separate from terms, defaulting to off
- [ ] Consent records versioned and RLS-protected
- [ ] Processing requiring consent is blocked without it

**Status:** Applied
