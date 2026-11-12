---
name: t143-minimum-password-standards-mobile
description: Enforce a minimum password policy for sign-up and password reset in the Expo app, server-side via Supabase Auth, with mobile-friendly rules.
---

# T143: Apply minimum password standards for mobile environments

**Category:** CODE_FIX
**SD Elements:** [T143](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T143/)
**Priority:** 7

**Spec Context:**
> "...login por e-mail e senha..." (...email and password login...)
> Source: specs/PRD.md, L5-7
> "No celular, adapte os formulários ao toque..." (On mobile, adapt forms for touch...)
> Source: specs/PRD.md, L49-51

**What the spec implies (naive approach):**
Accepting any password (Supabase default minimum of 6 chars) or only validating length in the client form.

**Secure Implementation Pattern:**
```ts
// packages/shared/src/validation.ts
export const PasswordSchema = z.string()
  .min(12, 'Use at least 12 characters')
  .max(128)
  .refine(p => !COMMON_PASSWORDS.has(p.toLowerCase()), 'This password is too common');

// UI: validate for feedback only; server (Supabase Auth) is the enforcement point.
<TextInput secureTextEntry autoComplete="new-password" textContentType="newPassword" />
```

**Implementation Guidance:**
- Supabase Auth settings: minimum length ≥ 12, enable leaked-password (HIBP) protection, required character classes only if org policy demands.
- Favor length/passphrases over punctuation rules for touch keyboards; allow paste and password managers.
- Apply identical rules for sign-up, team invite acceptance, change password and reset (T2).
- Show policy text in English on the form.

**Success Criteria:**
- [ ] Supabase Auth rejects passwords < 12 chars and known-leaked passwords
- [x] Same policy applied in sign-up, change and reset flows
- [x] Password fields support password managers (autoComplete/textContentType)

**Status:** Applied
