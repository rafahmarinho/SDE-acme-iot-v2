---
name: t2157-secure-email-and-messaging
description: Secure password-recovery and automation/alert notification emails sent by Supabase Auth and the API (TLS, SPF/DKIM/DMARC, no sensitive data in messages, no user-controlled recipients or headers).
---

# T2157: Secure email and messaging in web applications

**Category:** CODE_FIX
**SD Elements:** [T2157](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T2157/)
**Priority:** 7

**Spec Context:**
> "Inclua login, recuperação de senha, perfil..." (Include login, password recovery, profile...)
> Source: specs/PRD.md, line 11
> "...histórico e notificações." (history and notifications) — line 33

**What the spec implies (naive approach):**
Using Supabase's default SMTP for production recovery emails, putting device data or links with
long-lived tokens in emails, and letting automation actions send to arbitrary addresses.

**Secure Implementation Pattern:**
```ts
// apps/api/src/lib/mailer.ts — notifications only to verified org members
export async function notifyMembers(orgId: string, roles: Role[], key: TemplateKey, vars: Vars) {
  const { data: members } = await supabaseAdmin
    .from('memberships').select('user_id, users:auth_users(email)')
    .eq('organization_id', orgId).in('role', roles);
  const subject = SUBJECTS[key];                         // fixed subjects; no CRLF from user input
  const text = render(key, vars);                        // T1144
  for (const m of members ?? []) {
    await provider.send({ to: m.users.email, subject, text }); // provider over TLS (SMTP STARTTLS/HTTPS API)
  }
}
```

**Implementation Guidance:**
- Configure custom SMTP in Supabase Auth with SPF, DKIM and DMARC on the sending domain.
- Recovery emails: short-lived, single-use links (Supabase default), generic wording; no account existence leak.
- Automation recipients are selected by role/member, never free-form email addresses.
- Do not include readings considered sensitive (occupancy) or secrets in emails; link to the app instead.
- Strip CR/LF from any value used in headers.

**Success Criteria:**
- [ ] SPF/DKIM/DMARC pass for sent emails.
- [ ] Notifications only reach verified org members.
- [ ] Emails contain no tokens other than single-use auth links.

**Status:** Pending
