/**
 * Session lifecycle.
 * T164: one cleanup routine for explicit logout, API 401 and refresh failure — stops Realtime,
 *       signs out, clears in-memory query cache, offline cache and every SecureStore item.
 * T1539: on web, also wipes all browser storage and navigates to /auth/logout, which is served with
 *       `Clear-Site-Data: "cache", "cookies", "storage"` (apps/mobile/vercel.json, same origin as the app).
 */
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { wipeOfflineCache } from './offlineCache';
import { queryClient } from './queryClient';
import { realtime } from './realtime';
import { wipeSecureStorage } from './secureStorage';
import { supabase } from './supabase';
import { wipeBrowserStorage } from './webVault';

export type LogoutReason = 'user' | 'expired' | 'invalid' | 'deleted';

let loggingOut = false;

export async function clearLocalData(): Promise<void> {
  queryClient.clear();
  await wipeOfflineCache();
  if (Platform.OS === 'web') await wipeBrowserStorage();
  else await wipeSecureStorage();
}

export async function logout(reason: LogoutReason = 'user'): Promise<void> {
  if (loggingOut) return;
  loggingOut = true;
  try {
    await realtime.stopAll();
    // 'local' revokes this device's refresh token; the server-side session ends with it.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    await clearLocalData();
  } finally {
    loggingOut = false;
  }
  if (Platform.OS === 'web') {
    // Full navigation (not client routing) so the Clear-Site-Data response header is applied.
    window.location.assign(`/auth/logout?reason=${encodeURIComponent(reason)}`);
    return;
  }
  router.replace({ pathname: '/login', params: { reason } });
}

/** Registers the auth listener once at startup. */
export function registerSessionListener(): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' && !loggingOut) void clearLocalData();
    if (event === 'TOKEN_REFRESHED' && !session) void logout('expired');
  });
  return () => data.subscription.unsubscribe();
}
