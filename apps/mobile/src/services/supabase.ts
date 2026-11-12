/**
 * Supabase client (anon key only — the service role key never ships in the app; T76/T248).
 * Session persistence:
 *   - native: Keychain/Keystore via expo-secure-store, device-only accessibility (T270/T2133/T5634)
 *   - web: AES-GCM encrypted IndexedDB vault, nothing in localStorage (T1468)
 * PKCE flow: recovery/confirmation links carry a one-time code (not tokens) that we exchange and
 * immediately scrub from the URL (T2/T170).
 * All data access goes through RLS; the client never decides authorization (T145).
 */
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { env } from '@/config/env';
import { nativeSecureStorage } from './secureStorage';
import { webVault } from './webVault';

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? webVault : nativeSecureStorage,
    storageKey: 'sb-session',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // links are handled explicitly in linking.ts
    flowType: 'pkce',
  },
  realtime: { params: { eventsPerSecond: 10 } },
});

export async function currentAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
