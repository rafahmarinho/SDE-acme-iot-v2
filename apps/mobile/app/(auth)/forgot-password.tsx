/**
 * Password recovery request (T2).
 * The screen always shows the same message, with evened-out timing, whether or not the account exists.
 * Supabase Auth rate-limits e-mail sends and issues a single-use, short-lived PKCE link to an
 * allow-listed redirect URL.
 */
import { Link } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Card, Field, Message, Screen, s } from '@/components/ui';
import { requestPasswordReset } from '@/services/auth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMessage(await requestPasswordReset(email));
    setBusy(false);
  };

  return (
    <Screen title="Reset your password">
      <Card>
        <Text style={s.muted}>Enter the email you use for ACME IoT. We will send a link to choose a new password.</Text>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          maxLength={254}
        />
        <Message kind="success" text={message} />
        <Button label="Send reset link" onPress={() => void submit()} busy={busy} disabled={!email} />
        <Link href="/login" style={[s.muted, { textAlign: 'center' }]}>
          <Text>Back to sign in</Text>
        </Link>
      </Card>
    </Screen>
  );
}
