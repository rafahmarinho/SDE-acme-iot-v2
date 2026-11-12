/**
 * Authenticated area.
 * - No session → login (the requested path is passed as an allow-listed `redirect`, T37).
 * - First login or new privacy-policy version → dedicated consent screen before anything else (T178).
 * - Navigation adapts to the role in the active organization (UX only — T145).
 */
import { useQuery } from '@tanstack/react-query';
import { Redirect, Stack, usePathname } from 'expo-router';

import { Loading } from '@/components/ui';
import { OrgProvider } from '@/hooks/useOrg';
import { useSession } from '@/hooks/useSession';
import { safeInternalPath } from '@/lib/safeRoutes';
import { loadConsents } from '@/services/privacy';
import { colors } from '@/theme';

export default function AppLayout() {
  const { session, loading } = useSession();
  const pathname = usePathname();
  const consents = useQuery({ queryKey: ['consents', session?.user.id], queryFn: loadConsents, enabled: !!session });

  if (loading) return <Loading />;
  if (!session) return <Redirect href={{ pathname: '/login', params: { redirect: safeInternalPath(pathname) } }} />;
  if (consents.isLoading) return <Loading />;
  if (consents.data?.needsReview && pathname !== '/consent') return <Redirect href="/consent" />;

  return (
    <OrgProvider userId={session.user.id}>
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.card },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="consent" options={{ title: 'Privacy choices', headerBackVisible: false }} />
      </Stack>
    </OrgProvider>
  );
}
