/**
 * Authentication flows (Supabase Auth, email + password).
 * T2:   password reset with one generic response (no account enumeration), PKCE one-time code,
 *       allow-listed redirect, password policy on the new password, other sessions revoked afterwards.
 * T143: the same password policy for sign-up, change password and reset.
 * T20:  Supabase issues a fresh session on sign-in; we never reuse a pre-login session.
 * Rate limiting / CAPTCHA for e-mail sends is enforced by Supabase Auth (supabase/config.toml).
 */
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { env } from '@/config/env';
import { UserFacingError } from '@/lib/errors';
import { EmailSchema, PasswordSchema } from '@/lib/passwordPolicy';
import { clearLocalData } from './session';
import { supabase } from './supabase';

export const GENERIC_RESET_MESSAGE = 'If an account exists for this email, a reset link has been sent.';
const GENERIC_LOGIN_ERROR = 'Email or password is incorrect.';

/** Redirect must be in the Supabase "Redirect URLs" allow-list (web origin + acmeiot://reset-password). */
function resetRedirect(): string {
  return Platform.OS === 'web' ? `${env.webUrl}/reset-password` : Linking.createURL('/reset-password');
}

export async function signIn(email: string, password: string, captchaToken?: string): Promise<void> {
  const e = EmailSchema.safeParse(email);
  if (!e.success || password.length === 0 || password.length > 128) throw new UserFacingError(GENERIC_LOGIN_ERROR);
  await clearLocalData(); // never carry data from a previous user into the new session
  const { error } = await supabase.auth.signInWithPassword({
    email: e.data,
    password,
    options: captchaToken ? { captchaToken } : undefined,
  });
  if (error) throw new UserFacingError(GENERIC_LOGIN_ERROR);
}

export async function requestPasswordReset(email: string, captchaToken?: string): Promise<string> {
  const started = Date.now();
  const e = EmailSchema.safeParse(email);
  if (e.success) {
    // Errors are swallowed on purpose: the response must not reveal whether the account exists.
    await supabase.auth
      .resetPasswordForEmail(e.data, { redirectTo: resetRedirect(), captchaToken })
      .catch(() => undefined);
  }
  // Even out timing between valid / invalid / unknown addresses.
  const elapsed = Date.now() - started;
  if (elapsed < 800) await new Promise((r) => setTimeout(r, 800 - elapsed));
  return GENERIC_RESET_MESSAGE;
}

/** Exchanges the one-time PKCE code from the reset link for a short-lived recovery session. */
export async function beginRecovery(code: string): Promise<void> {
  if (!/^[A-Za-z0-9-]{8,128}$/.test(code)) throw new UserFacingError('This reset link is invalid or has expired.');
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw new UserFacingError('This reset link is invalid or has expired. Request a new one.');
}

export async function completePasswordReset(newPassword: string): Promise<void> {
  const parsed = PasswordSchema.safeParse(newPassword);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? 'Invalid password.');
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) throw new UserFacingError('Could not reset the password. Request a new link.');
  await supabase.auth.signOut({ scope: 'others' }); // revoke every other session
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) throw new UserFacingError('Please sign in again.');
  const parsed = PasswordSchema.safeParse(newPassword);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? 'Invalid password.');
  // Re-authenticate before a credential change.
  const reauth = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (reauth.error) throw new UserFacingError('Current password is incorrect.');
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) throw new UserFacingError('Could not change the password.');
  await supabase.auth.signOut({ scope: 'others' });
}

/** Email changes go through Supabase's double confirmation (old + new address) — T742. */
export async function requestEmailChange(newEmail: string): Promise<void> {
  const e = EmailSchema.safeParse(newEmail);
  if (!e.success) throw new UserFacingError('Enter a valid email address.');
  const { error } = await supabase.auth.updateUser({ email: e.data });
  if (error) throw new UserFacingError('Could not start the email change.');
}
