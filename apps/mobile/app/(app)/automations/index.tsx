/**
 * Automations: declarative condition → action rules with cooldown (PRD L31-33).
 * T279: rules are JSON validated by the shared `automationInput` schema and interpreted server-side;
 * no expressions or code are ever evaluated. Managing rules requires `automation.manage` (API enforced).
 */
import { automationInput, type AutomationInput } from '@acme-iot/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, Empty, Field, Loading, Message, Screen, s } from '@/components/ui';
import { useDevices } from '@/hooks/useDevices';
import { useOrg } from '@/hooks/useOrg';
import { toUserMessage } from '@/lib/errors';
import { uiCan } from '@/lib/permissions';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import { colors, space } from '@/theme';

export default function Automations() {
  const qc = useQueryClient();
  const { active } = useOrg();
  const devices = useDevices(active?.orgId);
  const [name, setName] = useState('');
  const [sensor, setSensor] = useState<string | null>(null);
  const [plug, setPlug] = useState<string | null>(null);
  const [threshold, setThreshold] = useState('26');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useQuery({
    queryKey: ['automations', active?.orgId],
    enabled: !!active,
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from('automations')
        .select('id, name, enabled, cooldown_seconds, last_run_at, automation_runs(status, ran_at)')
        .eq('org_id', active!.orgId)
        .order('name')
        .limit(100);
      if (e) throw e;
      return data ?? [];
    },
  });

  if (!active) return <Empty text="Select an organization first." />;
  const canManage = uiCan(active.role, 'automation.manage');
  const all = devices.data?.devices ?? [];
  const sensors = all.filter((d) => d.type === 'temperature_sensor' || d.type === 'thermostat');
  const plugs = all.filter((d) => d.type === 'smart_plug');

  const create = async () => {
    setError(null);
    const candidate: AutomationInput = {
      orgId: active.orgId,
      name: name.trim(),
      conditions: [{ deviceId: sensor ?? '', metric: 'temperature', operator: 'gt', value: Number(threshold) }],
      actions: [{ deviceId: plug ?? '', command: { kind: 'plug', on: true } }],
      cooldownSeconds: 600,
      notify: true,
      enabled: true,
    };
    const parsed = automationInput.safeParse(candidate);
    if (!parsed.success) return setError('Check the name, devices and threshold.');
    setBusy(true);
    try {
      await api.post('/api/automations', parsed.data);
      setName('');
      await qc.invalidateQueries({ queryKey: ['automations', active.orgId] });
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const picker = (items: typeof all, value: string | null, onPick: (id: string) => void) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {items.map((d) => (
        <Pressable key={d.id} onPress={() => onPick(d.id)} style={{ padding: space.sm, borderRadius: 8, backgroundColor: value === d.id ? colors.primary : colors.primarySoft }}>
          <Text style={{ color: value === d.id ? '#fff' : colors.primary }}>{d.name}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <Screen title="Automations">
      {list.isLoading ? <Loading /> : null}
      {(list.data ?? []).map((a) => (
        <Card key={a.id}>
          <View style={s.row}>
            <Text style={s.itemTitle}>{a.name}</Text>
            <Text style={s.muted}>{a.enabled ? 'Enabled' : 'Disabled'}</Text>
          </View>
          <Text style={s.muted}>Cooldown {Math.round(a.cooldown_seconds / 60)} min · Last run {a.last_run_at ? new Date(a.last_run_at).toLocaleString() : 'never'}</Text>
        </Card>
      ))}
      {list.data?.length === 0 ? <Empty text="No automations yet." /> : null}
      {canManage ? (
        <Card>
          <Text style={s.itemTitle}>New rule: when temperature is above a threshold, turn a plug on</Text>
          <Field label="Name" value={name} onChangeText={setName} maxLength={120} />
          <Text style={s.label}>Temperature source</Text>
          {picker(sensors, sensor, setSensor)}
          <Field label="Threshold (°C)" value={threshold} onChangeText={setThreshold} keyboardType="decimal-pad" maxLength={6} />
          <Text style={s.label}>Plug to turn on</Text>
          {picker(plugs, plug, setPlug)}
          <Message kind="error" text={error} />
          <Button label="Create automation" onPress={() => void create()} busy={busy} />
        </Card>
      ) : null}
    </Screen>
  );
}
