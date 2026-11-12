/**
 * Settings: privacy choices (T178/T604), data controls (T5660), biometric unlock (T5633), sign out (T164/T1539).
 * - Withdrawing consent is one tap, same effort as granting; it takes effect immediately via the API.
 * - Export my data, clear local data, and delete account (re-authentication required; sole owners blocked
 *   server-side until ownership is transferred).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Platform, Share, Switch, Text, View } from 'react-native';

import { SecretInput } from '@/components/SecretInput';
import { Button, Card, Loading, Message, Screen, s } from '@/components/ui';
import { toUserMessage } from '@/lib/errors';
import {
  biometricAvailable,
  confirmSensitiveAction,
  disableBiometric,
  enableBiometric,
  isBiometricEnabled,
} from '@/services/biometric';
import { CONSENT_PURPOSES, deleteAccount, exportMyData, loadConsents, setConsent, type ConsentPurpose } from '@/services/privacy';
import { clearLocalData, logout } from '@/services/session';
import { colors } from '@/theme';

export default function Settings() {
  const qc = useQueryClient();
  const consents = useQuery({ queryKey: ['consents', 'settings'], queryFn: loadConsents });
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void biometricAvailable().then(setBioAvailable);
    void isBiometricEnabled().then(setBioEnabled);
  }, []);

  const run = async (key: string, fn: () => Promise<void>, ok?: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg({ kind: 'success', text: ok });
    } catch (e) {
      setMsg({ kind: 'error', text: toUserMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  if (consents.isLoading) return <Loading />;

  return (
    <Screen title="Settings">
      <Message kind={msg?.kind} text={msg?.text ?? null} />

      <Card>
        <Text style={s.itemTitle}>Privacy choices</Text>
        {(Object.keys(CONSENT_PURPOSES) as ConsentPurpose[]).map((p) => (
          <View key={p} style={{ gap: 4 }}>
            <View style={s.row}>
              <Text style={{ color: colors.text }}>{CONSENT_PURPOSES[p].title}</Text>
              <Switch
                value={consents.data?.[p].granted ?? false}
                disabled={busy === p}
                trackColor={{ true: colors.primary, false: colors.border }}
                onValueChange={(v) =>
                  void run(p, async () => {
                    await setConsent(p, v);
                    await qc.invalidateQueries({ queryKey: ['consents'] });
                  }, v ? 'Consent given.' : 'Consent withdrawn. Related processing has stopped.')
                }
              />
            </View>
            <Text style={s.muted}>{CONSENT_PURPOSES[p].description}</Text>
          </View>
        ))}
      </Card>

      {Platform.OS !== 'web' && bioAvailable ? (
        <Card>
          <View style={s.row}>
            <Text style={{ color: colors.text }}>Unlock with biometrics</Text>
            <Switch
              value={bioEnabled}
              trackColor={{ true: colors.primary, false: colors.border }}
              onValueChange={(v) =>
                void run('bio', async () => {
                  if (v) await enableBiometric();
                  else await disableBiometric();
                  setBioEnabled(v);
                })
              }
            />
          </View>
          <Text style={s.muted}>Also required to confirm firmware rollouts, rollbacks and data resets.</Text>
        </Card>
      ) : null}

      <Card>
        <Text style={s.itemTitle}>Your data</Text>
        <Button
          label="Export my data"
          variant="secondary"
          busy={busy === 'export'}
          onPress={() =>
            void run('export', async () => {
              const json = await exportMyData();
              await Share.share({ message: json, title: 'ACME IoT data export' });
            })
          }
        />
        <Button
          label="Clear data on this device"
          variant="secondary"
          busy={busy === 'clear'}
          onPress={() =>
            void run('clear', async () => {
              await confirmSensitiveAction('Confirm clearing local data');
              await clearLocalData();
              await logout('user');
            })
          }
        />
        <SecretInput kind="current-password" label="Password (required to delete your account)" value={deletePassword} onChangeText={setDeletePassword} />
        <Button
          label="Delete my account"
          variant="danger"
          busy={busy === 'delete'}
          disabled={!deletePassword}
          onPress={() =>
            void run('delete', async () => {
              await confirmSensitiveAction('Confirm account deletion');
              await deleteAccount(deletePassword);
              setDeletePassword('');
            })
          }
        />
      </Card>

      <Button label="Sign out" variant="secondary" onPress={() => void logout('user')} />
    </Screen>
  );
}
