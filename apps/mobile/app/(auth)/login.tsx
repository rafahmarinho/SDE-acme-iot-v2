/**
 * Login (email + password via Supabase Auth).
 * - One generic error for wrong email or password (no enumeration).
 * - Sensitive field hardening (T316); password managers supported.
 * - Optional `redirect` param restricted to internal allow-listed routes (T37).
 * - Brute-force throttling / CAPTCHA enforced by Supabase Auth rate limits (supabase/config.toml).
 */
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { SecretInput } from '@/components/SecretInput';
import { Button, Card, Field, Message, Screen, s } from '@/components/ui';
import { toUserMessage } from '@/lib/errors';
import { safeInternalPath } from '@/lib/safeRoutes';
import { signIn } from '@/services/auth';

const REASONS: Record<string, string> = {
  expired: 'Your session has expired. Please sign in again.',
  deleted: 'Your account has been deleted.',
  user: 'You have been signed out.',
};

export default function Login() {
  const params = useLocalSearchParams<{ redirect?: string; reason?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      setPassword('');
      router.replace(safeInternalPath(params.redirect) as never);
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Sign in to ACME IoT">
      <Message text={params.reason ? (REASONS[params.reason] ?? null) : null} />
      <Card>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          inputMode="email"
          maxLength={254}
        />
        <SecretInput kind="current-password" label="Password" value={password} onChangeText={setPassword} onSubmitEditing={() => void submit()} />
        <Message kind="error" text={error} />
        <Button label="Sign in" onPress={() => void submit()} busy={busy} disabled={!email || !password} />
        <Link href="/forgot-password" style={[s.muted, { textAlign: 'center' }]}>
          <Text>Forgot your password?</Text>
        </Link>
      </Card>
    </Screen>
  );
}
