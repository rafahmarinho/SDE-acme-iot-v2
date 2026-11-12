---
name: t2-secure-password-reset
description: Secure the password recovery flow (Supabase Auth reset email) against account enumeration, token abuse and automation for the ACME IoT app.
---

# T2: Secure the password reset mechanism

**Category:** CODE_FIX
**SD Elements:** [T2](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T2/)
**Priority:** 9

**Spec Context:**
> "Inclua login, recuperação de senha, perfil, configurações..." (Include login, password recovery, profile, settings...)
> Source: specs/PRD.md, L11

**What the spec implies (naive approach):**
A "forgot password" screen that calls the API with an email and shows "email not found" vs "email sent", with no rate limiting, a long-lived reset link, and the user staying logged in on other devices after the reset.

**Secure Implementation Pattern:**
```ts
// apps/mobile/app/(auth)/forgot-password.tsx (service part)
export async function requestReset(email: string) {
  const parsed = EmailSchema.safeParse(email.trim().toLowerCase());
  if (!parsed.success) return { ok: true }; // never reveal validity
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${APP_URL}/reset-password`, // allow-listed in Supabase Auth URL config
  });
  return { ok: true }; // identical response whether or not the account exists
}

// After the user follows the link (PASSWORD_RECOVERY event):
export async function completeReset(newPassword: string) {
  assertPasswordPolicy(newPassword);             // see T143
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new UserFacingError('Could not reset password. Request a new link.');
  await supabase.auth.signOut({ scope: 'others' }); // invalidate other sessions
}
```

**Implementation Guidance:**
- Show one generic message: "If an account exists, a reset link has been sent."
- Configure Supabase Auth: short OTP/link expiry (≤ 1h), single-use tokens, redirect URL allow-list limited to the app/web domains.
- Enable Supabase Auth rate limits for email sends; add CAPTCHA (Supabase hCaptcha/Turnstile integration) on the request form.
- Enforce password policy (T143) on the new password; never email the password itself.
- Notify the user by email that the password was changed; revoke other sessions after reset.
- Log reset requests/completions to the `events` table (no tokens in logs).

**Success Criteria:**
- [ ] Response and timing are identical for existing and non-existing emails
- [ ] Reset links expire and cannot be reused
- [ ] Reset request endpoint is rate limited and CAPTCHA-protected
- [ ] Other sessions are revoked after a successful reset

**Status:** Pending
