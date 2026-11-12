/**
 * Consent screen (T178), separate from the Terms of Service.
 * Every optional purpose defaults to OFF and is explained in plain language. The choice is stored per
 * purpose with the policy version and timestamp. The same choices can be changed or withdrawn any time
 * in Settings (T604).
 */
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { Button, Card, Message, Screen, s } from '@/components/ui';
import { PRIVACY_POLICY_VERSION } from '@/config/env';
import { toUserMessage } from '@/lib/errors';
import { CONSENT_PURPOSES, saveConsents, type ConsentPurpose } from '@/services/privacy';
import { colors } from '@/theme';

export default function Consent() {
  const qc = useQueryClient();
  const [choices, setChoices] = useState<Record<ConsentPurpose, boolean>>({ occupancy_analytics: false, product_emails: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveConsents(choices);
      await qc.invalidateQueries({ queryKey: ['consents'] });
      router.replace('/');
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Your privacy choices">
      <Text style={s.muted}>
        ACME IoT needs your email and name to run your account. The options below are optional and off unless
        you turn them on. You can change them at any time in Settings. Privacy notice version {PRIVACY_POLICY_VERSION}.
      </Text>
      {(Object.keys(CONSENT_PURPOSES) as ConsentPurpose[]).map((p) => (
        <Card key={p}>
          <View style={s.row}>
            <Text style={s.itemTitle}>{CONSENT_PURPOSES[p].title}</Text>
            <Switch
              value={choices[p]}
              onValueChange={(v) => setChoices((c) => ({ ...c, [p]: v }))}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel={CONSENT_PURPOSES[p].title}
            />
          </View>
          <Text style={s.muted}>{CONSENT_PURPOSES[p].description}</Text>
        </Card>
      ))}
      <Message kind="error" text={error} />
      <Button label="Save choices" onPress={() => void save()} busy={busy} />
    </Screen>
  );
}
