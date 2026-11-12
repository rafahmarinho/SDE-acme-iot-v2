/**
 * Profile (T742): users view and correct their own personal data; the name lives once in `profiles`.
 * Email changes use Supabase's verification flow (confirmation to the new and old address).
 * Password change re-authenticates and applies the shared policy (T143), revoking other sessions.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { SecretInput } from '@/components/SecretInput';
import { Button, Card, Field, Loading, Message, Screen, s } from '@/components/ui';
import { useSession } from '@/hooks/useSession';
import { toUserMessage } from '@/lib/errors';
import { PASSWORD_POLICY_TEXT, passwordProblems } from '@/lib/passwordPolicy';
import { changePassword, requestEmailChange } from '@/services/auth';
import { loadProfile, saveProfile } from '@/services/privacy';

export default function Profile() {
  const qc = useQueryClient();
  const { session } = useSession();
  const profile = useQuery({ queryKey: ['profile'], queryFn: loadProfile });
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (profile.data) setDisplayName(profile.data.displayName);
  }, [profile.data]);

  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: 'success', text: ok });
    } catch (e) {
      setMsg({ kind: 'error', text: toUserMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  if (profile.isLoading) return <Loading />;
  const problems = next ? passwordProblems(next) : [];

  return (
    <Screen title="Profile">
      <Message kind={msg?.kind} text={msg?.text ?? null} />
      <Card>
        <Field label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={80} />
        {profile.data?.updatedAt ? <Text style={s.muted}>Last updated {new Date(profile.data.updatedAt).toLocaleString()}</Text> : null}
        <Button
          label="Save name"
          busy={busy === 'name'}
          onPress={() =>
            void run('name', async () => {
              await saveProfile({ displayName });
              await qc.invalidateQueries({ queryKey: ['profile'] });
            }, 'Profile saved.')
          }
        />
      </Card>
      <Card>
        <Text style={s.muted}>Current email: {session?.user.email ?? '—'}</Text>
        <Field label="New email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" maxLength={254} />
        <Button
          label="Change email"
          variant="secondary"
          busy={busy === 'email'}
          onPress={() => void run('email', () => requestEmailChange(email), 'Check both inboxes to confirm the change.')}
        />
      </Card>
      <Card>
        <Text style={s.muted}>{PASSWORD_POLICY_TEXT}</Text>
        <SecretInput kind="current-password" label="Current password" value={current} onChangeText={setCurrent} />
        <SecretInput kind="new-password" label="New password" value={next} onChangeText={setNext} error={problems[0] ?? null} />
        <Button
          label="Change password"
          variant="secondary"
          busy={busy === 'pw'}
          disabled={!current || !next || problems.length > 0}
          onPress={() =>
            void run('pw', async () => {
              await changePassword(current, next);
              setCurrent('');
              setNext('');
            }, 'Password changed. Other devices were signed out.')
          }
        />
      </Card>
    </Screen>
  );
}
