/**
 * Choose a new password after following the reset link (T2/T143).
 * - The one-time PKCE `code` is exchanged once and immediately scrubbed from the URL/history (T170).
 * - The new password must satisfy the shared policy; other sessions are revoked on success.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Text } from 'react-native';

import { SecretInput } from '@/components/SecretInput';
import { Button, Card, Loading, Message, Screen, s } from '@/components/ui';
import { toUserMessage } from '@/lib/errors';
import { PASSWORD_POLICY_TEXT, passwordProblems } from '@/lib/passwordPolicy';
import { beginRecovery, completePasswordReset } from '@/services/auth';
import { logout } from '@/services/session';

export default function ResetPassword() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const exchanged = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;
    const run = async () => {
      if (Platform.OS === 'web') window.history.replaceState(null, '', '/reset-password'); // scrub code
      router.setParams({ code: undefined });
      if (!code) throw new Error('missing code');
      await beginRecovery(code);
    };
    run()
      .then(() => setReady(true))
      .catch((e) => setError(toUserMessage(e, 'This reset link is invalid or has expired. Request a new one.')));
  }, [code]);

  const problems = password ? passwordProblems(password) : [];
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await completePasswordReset(password);
      setPassword('');
      setConfirm('');
      setDone(true);
      await logout('user'); // sign in again with the new password
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!ready && !error) return <Loading label="Checking your link…" />;

  return (
    <Screen title="Choose a new password">
      <Card>
        {error ? (
          <>
            <Message kind="error" text={error} />
            <Button label="Request a new link" onPress={() => router.replace('/forgot-password')} />
          </>
        ) : done ? (
          <Message kind="success" text="Your password has been changed. Please sign in." />
        ) : (
          <>
            <Text style={s.muted}>{PASSWORD_POLICY_TEXT}</Text>
            <SecretInput kind="new-password" label="New password" value={password} onChangeText={setPassword} error={problems[0] ?? null} />
            <SecretInput kind="new-password" label="Confirm new password" value={confirm} onChangeText={setConfirm} error={mismatch ? 'Passwords do not match.' : null} />
            <Button label="Save password" onPress={() => void submit()} busy={busy} disabled={!password || problems.length > 0 || confirm !== password} />
          </>
        )}
      </Card>
    </Screen>
  );
}
