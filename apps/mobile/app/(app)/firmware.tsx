/**
 * Firmware releases, rollout progress and rollback (PRD L35-37).
 * Releases are signed server-side (Ed25519) and verified before install by the device simulator
 * (T2486/T197). The client never receives storage paths or download URLs (column grants).
 * Rollout/rollback: `firmware.rollout`/`firmware.rollback` enforced by the API, plus biometric
 * confirmation when enabled (T5633).
 */
import { firmwareRolloutInput } from '@acme-iot/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, Empty, Loading, Message, Screen, s } from '@/components/ui';
import { useDevices } from '@/hooks/useDevices';
import { useOrg } from '@/hooks/useOrg';
import { toUserMessage } from '@/lib/errors';
import { uiCan } from '@/lib/permissions';
import { api } from '@/services/api';
import { confirmSensitiveAction } from '@/services/biometric';
import { supabase } from '@/services/supabase';

export default function Firmware() {
  const qc = useQueryClient();
  const { active } = useOrg();
  const devices = useDevices(active?.orgId);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const releases = useQuery({
    queryKey: ['firmware_releases', active?.orgId],
    enabled: !!active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('firmware_releases')
        .select('id, device_type, version, sha256, created_at')
        .eq('org_id', active!.orgId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  const rollouts = useQuery({
    queryKey: ['firmware_rollouts', active?.orgId],
    enabled: !!active,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('firmware_rollouts')
        .select('id, release_id, device_id, status, progress, previous_version, updated_at')
        .eq('org_id', active!.orgId)
        .order('updated_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!active) return <Empty text="Select an organization first." />;
  const canRollout = uiCan(active.role, 'firmware.rollout');
  const canRollback = uiCan(active.role, 'firmware.rollback');
  const nameOf = (id: string) => devices.data?.devices.find((d) => d.id === id)?.name ?? 'Device';

  const rollout = async (releaseId: string, deviceType: string) => {
    setMsg(null);
    try {
      const deviceIds = (devices.data?.devices ?? []).filter((d) => d.type === deviceType).map((d) => d.id).slice(0, 100);
      const body = firmwareRolloutInput.parse({ orgId: active.orgId, releaseId, deviceIds });
      await confirmSensitiveAction('Confirm firmware rollout');
      await api.post('/api/firmware/rollouts', body);
      setMsg({ kind: 'success', text: 'Rollout started.' });
      await qc.invalidateQueries({ queryKey: ['firmware_rollouts', active.orgId] });
    } catch (e) {
      setMsg({ kind: 'error', text: toUserMessage(e, 'Could not start the rollout.') });
    }
  };

  const rollback = async (rolloutId: string) => {
    setMsg(null);
    try {
      await confirmSensitiveAction('Confirm firmware rollback');
      await api.post('/api/firmware/rollback', { orgId: active.orgId, rolloutId });
      setMsg({ kind: 'success', text: 'Rollback requested.' });
      await qc.invalidateQueries({ queryKey: ['firmware_rollouts', active.orgId] });
    } catch (e) {
      setMsg({ kind: 'error', text: toUserMessage(e, 'Could not roll back.') });
    }
  };

  return (
    <Screen title="Firmware">
      <Message kind={msg?.kind} text={msg?.text ?? null} />
      {releases.isLoading ? <Loading /> : null}
      {(releases.data ?? []).map((r) => (
        <Card key={r.id}>
          <View style={s.row}>
            <Text style={s.itemTitle}>{r.device_type} v{r.version}</Text>
            <Text style={s.muted}>{new Date(r.created_at).toLocaleDateString()}</Text>
          </View>
          <Text style={s.muted} selectable>SHA-256 {r.sha256.slice(0, 16)}…</Text>
          {canRollout ? <Button label="Roll out to all devices of this type" onPress={() => void rollout(r.id, r.device_type)} /> : null}
        </Card>
      ))}
      {releases.data?.length === 0 ? <Empty text="No firmware releases." /> : null}
      <Text style={s.itemTitle}>Rollouts</Text>
      {(rollouts.data ?? []).map((ro) => (
        <Card key={ro.id}>
          <View style={s.row}>
            <Text style={s.itemTitle}>{nameOf(ro.device_id)}</Text>
            <Text style={s.muted}>{ro.status} · {ro.progress}%</Text>
          </View>
          {canRollback && ro.previous_version && (ro.status === 'succeeded' || ro.status === 'failed') ? (
            <Button label={`Roll back to v${ro.previous_version}`} variant="danger" onPress={() => void rollback(ro.id)} />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
