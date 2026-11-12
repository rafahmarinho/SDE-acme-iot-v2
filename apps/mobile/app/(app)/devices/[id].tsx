/**
 * Device detail: readings, desired vs reported state and controls (PRD L29-31).
 * - T145/T17: controls are shown to owner/admin/operator only, but the API re-authorizes every command.
 * - Commands are validated with the shared schema (setpoint 5–35 °C, plug on/off) before sending (T42).
 * - Control actions require a connection (api.ts) and an explicit tap — never triggered by links (T170).
 * - Device-reported values are untrusted and rendered as text (T36).
 */
import { deviceCommand, type DeviceCommand } from '@acme-iot/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { DeviceCard } from '@/components/DeviceCard';
import { Button, Card, Empty, Loading, Message, Screen, s } from '@/components/ui';
import { useDevices } from '@/hooks/useDevices';
import { useOrg } from '@/hooks/useOrg';
import { toUserMessage } from '@/lib/errors';
import { uiCan } from '@/lib/permissions';
import { isUuid } from '@/lib/safeRoutes';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import { space } from '@/theme';

export default function DeviceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { active } = useOrg();
  const devices = useDevices(active?.orgId);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const deviceId = isUuid(id) ? id : null;
  const readings = useQuery({
    queryKey: ['readings', deviceId],
    enabled: !!deviceId && !devices.data?.offlineSince,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('readings')
        .select('metric, value, recorded_at')
        .eq('device_id', deviceId!)
        .order('recorded_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!deviceId) return <Empty text="Device not found." />;
  if (devices.isLoading) return <Loading />;
  const device = devices.data?.devices.find((d) => d.id === deviceId);
  if (!device || !active) return <Empty text="Device not found." />;

  const offline = !!devices.data?.offlineSince;
  const canControl = uiCan(active.role, 'device.control') && !offline;
  const setpoint = typeof device.desired?.setpoint === 'number' ? device.desired.setpoint : 21;

  const send = async (cmd: DeviceCommand) => {
    const parsed = deviceCommand.safeParse(cmd);
    if (!parsed.success) return setMsg({ kind: 'error', text: 'Value out of range.' });
    setBusy(true);
    setMsg(null);
    try {
      await api.post(`/api/devices/${deviceId}/command`, parsed.data);
      setMsg({ kind: 'success', text: 'Command sent. Waiting for the device to report.' });
      await qc.invalidateQueries({ queryKey: ['devices', active.orgId] });
    } catch (e) {
      setMsg({ kind: 'error', text: toUserMessage(e, 'The command could not be sent.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={device.name}>
      <DeviceCard device={device} />
      {offline ? <Message kind="error" text="Offline: showing the last saved data. Controls need a connection." /> : null}
      {canControl && device.type === 'thermostat' ? (
        <Card>
          <Text style={s.itemTitle}>Target temperature: {setpoint.toFixed(1)} °C</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="−0.5 °C" variant="secondary" busy={busy} onPress={() => void send({ kind: 'setpoint', celsius: setpoint - 0.5 })} />
            <Button label="+0.5 °C" variant="secondary" busy={busy} onPress={() => void send({ kind: 'setpoint', celsius: setpoint + 0.5 })} />
          </View>
        </Card>
      ) : null}
      {canControl && device.type === 'smart_plug' ? (
        <Card>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="Turn on" busy={busy} onPress={() => void send({ kind: 'plug', on: true })} />
            <Button label="Turn off" variant="danger" busy={busy} onPress={() => void send({ kind: 'plug', on: false })} />
          </View>
        </Card>
      ) : null}
      <Message kind={msg?.kind} text={msg?.text ?? null} />
      <Card>
        <Text style={s.itemTitle}>Latest readings</Text>
        {(readings.data ?? []).map((r) => (
          <Text key={`${r.metric}-${r.recorded_at}`} style={s.muted}>
            {new Date(r.recorded_at).toLocaleString()} — {r.metric}: {Number(r.value).toFixed(1)}
          </Text>
        ))}
        {readings.data?.length === 0 ? <Text style={s.muted}>No readings yet.</Text> : null}
      </Card>
    </Screen>
  );
}
