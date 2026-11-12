/**
 * Client configuration. Only EXPO_PUBLIC_* values are available here and they are PUBLIC
 * (bundled into the app). Never put secrets in them (T76/T248).
 * Every endpoint must be https (T21/T146); the app refuses to start otherwise.
 */
function requireHttps(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}`);
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error(`${name} must use https://`);
  return url.origin;
}

export const env = {
  supabaseUrl: requireHttps('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: (() => {
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!key) throw new Error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY');
    return key;
  })(),
  apiBaseUrl: requireHttps('EXPO_PUBLIC_API_BASE_URL', process.env.EXPO_PUBLIC_API_BASE_URL),
  webUrl: requireHttps('EXPO_PUBLIC_WEB_URL', process.env.EXPO_PUBLIC_WEB_URL),
} as const;

/** Version of the privacy notice the consent screen refers to (T178/T604). */
export const PRIVACY_POLICY_VERSION = '2026-11-01';
