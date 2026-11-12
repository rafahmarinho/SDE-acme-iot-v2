/**
 * Password policy (T143). Mirrors supabase/config.toml (min length 12, letters + digits).
 * Client validation is for user feedback only; Supabase Auth is the enforcement point
 * (it also rejects leaked passwords when HIBP protection is enabled).
 * Used identically by sign-up/invite acceptance, change password and password reset (T2).
 */
import { z } from 'zod';

const COMMON_PASSWORDS = new Set([
  'password1234', 'qwerty123456', '123456789012', 'iloveyou1234', 'welcome12345',
  'admin1234567', 'letmein12345', 'passw0rd1234', 'acmeiot12345', 'changeme1234',
]);

export const PASSWORD_POLICY_TEXT =
  'Use at least 12 characters with letters and numbers. Passphrases are welcome.';

export const PasswordSchema = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(128, 'Use at most 128 characters.')
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Include letters and numbers.')
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), 'This password is too common.');

export const EmailSchema = z.string().trim().toLowerCase().email().max(254);

export function passwordProblems(password: string): string[] {
  const res = PasswordSchema.safeParse(password);
  return res.success ? [] : res.error.issues.map((i) => i.message);
}
