/**
 * Privacy controls.
 * T178: consent per purpose, separate from terms, default OFF, versioned (consents table, RLS: own rows).
 * T604: withdrawal is one tap and takes effect immediately; the API propagates it to processing jobs and
 *       simulated integrations and writes an audit event.
 * T742: users maintain their own profile (single source of truth: profiles table).
 * T5660: export my data, clear local data, delete account (re-authentication required).
 */
import { consentInput, profileInput } from '@acme-iot/shared';
import { z } from 'zod';

import { PRIVACY_POLICY_VERSION } from '@/config/env';
import { UserFacingError } from '@/lib/errors';
import { api } from './api';
import { logout } from './session';
import { supabase } from './supabase';

export const CONSENT_PURPOSES = {
  occupancy_analytics: {
    title: 'Occupancy analytics',
    description:
      'Use occupancy sensor history linked to rooms you manage to build usage reports. Without consent, only live occupancy is shown.',
  },
  product_emails: {
    title: 'Product and notification emails',
    description: 'Send alert and automation notifications to your email address.',
  },
} as const;
export type ConsentPurpose = keyof typeof CONSENT_PURPOSES;
const Purpose = z.enum(['occupancy_analytics', 'product_emails']);

export type ConsentState = Record<ConsentPurpose, { granted: boolean; policyVersion: string | null }>;

async function userId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new UserFacingError('Please sign in again.');
  return data.user.id;
}

export async function loadConsents(): Promise<ConsentState & { needsReview: boolean }> {
  const uid = await userId();
  const { data, error } = await supabase.from('consents').select('purpose, granted, policy_version').eq('user_id', uid);
  if (error) throw new UserFacingError('Could not load your privacy choices.');
  const state: ConsentState = {
    occupancy_analytics: { granted: false, policyVersion: null },
    product_emails: { granted: false, policyVersion: null },
  };
  for (const row of data ?? []) {
    const p = Purpose.safeParse(row.purpose);
    if (p.success) state[p.data] = { granted: row.granted === true, policyVersion: row.policy_version ?? null };
  }
  const needsReview = Object.values(state).some((s) => s.policyVersion !== PRIVACY_POLICY_VERSION);
  return { ...state, needsReview };
}

/** Records an explicit choice for every purpose (first-login consent screen and Settings). */
export async function saveConsents(choices: Record<ConsentPurpose, boolean>): Promise<void> {
  const uid = await userId();
  const rows = (Object.keys(CONSENT_PURPOSES) as ConsentPurpose[]).map((purpose) => ({
    user_id: uid,
    purpose,
    granted: choices[purpose] === true,
    policy_version: PRIVACY_POLICY_VERSION,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from('consents').upsert(rows, { onConflict: 'user_id,purpose' });
  if (error) throw new UserFacingError('Could not save your privacy choices.');
}

export async function setConsent(purpose: ConsentPurpose, granted: boolean): Promise<void> {
  if (granted) {
    const uid = await userId();
    const { error } = await supabase.from('consents').upsert(
      { user_id: uid, purpose, granted: true, policy_version: PRIVACY_POLICY_VERSION, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,purpose' },
    );
    if (error) throw new UserFacingError('Could not save your choice.');
    return;
  }
  // Withdrawal goes through the API so dependent processing stops and integrations are notified (T604).
  await api.post(
    '/api/me/consents',
    consentInput.parse({ purpose: Purpose.parse(purpose), granted: false, policyVersion: PRIVACY_POLICY_VERSION }),
  );
}

export const ProfileInput = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Enter your name.')
    .max(80, 'Use at most 80 characters.')
    .regex(/^[\p{L}\p{M}\p{N} .'\-]+$/u, 'Use letters, numbers, spaces, dots, apostrophes or hyphens.'),
});

export async function loadProfile() {
  const uid = await userId();
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, updated_at')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw new UserFacingError('Could not load your profile.');
  return { displayName: data?.display_name ?? '', updatedAt: data?.updated_at ?? null };
}

export async function saveProfile(input: { displayName: string }): Promise<void> {
  const parsed = ProfileInput.safeParse(input);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? 'Invalid profile.');
  profileInput.parse({ displayName: parsed.data.displayName, locale: 'en' }); // same rule as the API
  const uid = await userId();
  const { error } = await supabase
    .from('profiles')
    .upsert({ user_id: uid, display_name: parsed.data.displayName, updated_at: new Date().toISOString() });
  if (error) throw new UserFacingError('Could not save your profile.');
}

/** Builds a JSON export of the user's own personal data (RLS limits every query to the caller). */
export async function exportMyData(): Promise<string> {
  const uid = await userId();
  const [{ data: user }, profile, memberships, consents] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('profiles').select('display_name, updated_at').eq('user_id', uid).maybeSingle(),
    supabase.from('memberships').select('org_id, role').eq('user_id', uid),
    supabase.from('consents').select('purpose, granted, policy_version, updated_at').eq('user_id', uid),
  ]);
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      account: { id: uid, email: user.user?.email ?? null, createdAt: user.user?.created_at ?? null },
      profile: profile.data,
      memberships: memberships.data ?? [],
      consents: consents.data ?? [],
    },
    null,
    2,
  );
}

/** Deletes the account after re-authentication; server blocks sole owners and revokes all sessions. */
export async function deleteAccount(password: string): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) throw new UserFacingError('Please sign in again.');
  const reauth = await supabase.auth.signInWithPassword({ email, password });
  if (reauth.error) throw new UserFacingError('Password is incorrect.');
  try {
    await api.post('/api/me/delete', {});
  } catch (err) {
    if (err instanceof Error && 'status' in err && (err as { status: number }).status === 409) {
      throw new UserFacingError('Transfer ownership of your organizations before deleting your account.');
    }
    throw err;
  }
  await logout('deleted');
}
