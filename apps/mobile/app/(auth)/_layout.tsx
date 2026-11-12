import { Redirect, Stack, useSegments } from 'expo-router';

import { Loading } from '@/components/ui';
import { useSession } from '@/hooks/useSession';

/** Signed-in users are sent to the app — except on the reset screen, which runs on a recovery session. */
export default function AuthLayout() {
  const { session, loading } = useSession();
  const segments = useSegments();
  if (loading) return <Loading />;
  const onReset = segments[segments.length - 1] === 'reset-password';
  if (session && !onReset) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
