/**
 * Root layout: providers, session lifecycle and the biometric lock.
 * - T164: registers the single logout/cleanup listener.
 * - T5633: when biometric unlock is enabled, the app locks after 5 minutes in the background and is
 *   unlocked by releasing an access-controlled Keychain item (not a JS boolean). Fallback: sign out.
 * - T2133: the lock screen also hides content while the app is in the app switcher.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button, s } from '@/components/ui';
import { toUserMessage } from '@/lib/errors';
import { isBiometricEnabled, unlockApp } from '@/services/biometric';
import { queryClient } from '@/services/queryClient';
import { logout, registerSessionListener } from '@/services/session';
import { supabase } from '@/services/supabase';
import { colors } from '@/theme';

const LOCK_AFTER_MS = 5 * 60 * 1000;

function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const tryUnlock = async () => {
    try {
      await unlockApp();
      onUnlocked();
    } catch (e) {
      setError(toUserMessage(e));
    }
  };
  useEffect(() => {
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={[s.center, { backgroundColor: colors.bg }]}>
      <Text style={s.title}>ACME IoT is locked</Text>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Button label="Unlock" onPress={() => void tryUnlock()} />
      <Button label="Sign out" variant="secondary" onPress={() => void logout('user')} />
    </View>
  );
}

export default function RootLayout() {
  const [locked, setLocked] = useState(false);
  const [obscured, setObscured] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => registerSessionListener(), []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // Lock on cold start when a session exists and biometrics are enabled.
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session && (await isBiometricEnabled())) setLocked(true);
    })();
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        setObscured(false);
        const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        backgroundedAt.current = null;
        if (away > LOCK_AFTER_MS && (await isBiometricEnabled())) setLocked(true);
      } else {
        setObscured(true); // hide PII in the app switcher snapshot
        backgroundedAt.current ??= Date.now();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        {locked ? <LockScreen onUnlocked={() => setLocked(false)} /> : <Slot />}
        {obscured && !locked ? <View style={{ position: 'absolute', inset: 0, backgroundColor: colors.bg }} /> : null}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
