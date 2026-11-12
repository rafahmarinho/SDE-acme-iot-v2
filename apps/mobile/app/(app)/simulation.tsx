/**
 * Simulation area: scenarios, advance, events, reset demo data (PRD L43-47).
 * T49: available only when the API reports the simulation feature as enabled (server flag) and the
 * caller is owner/admin (`simulation.advance` / `simulation.reset` — enforced by the API). Reset requires
 * biometric confirmation when enabled (T5633). Inputs validated with the shared `simulationInput` schema.
 */
import { SCENARIOS, simulationInput } from '@acme-iot/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Card, Empty, Loading, Message, Screen, s } from '@/components/ui';
import { useOrg } from '@/hooks/useOrg';
import { toUserMessage } from '@/lib/errors';
import { uiCan } from '@/lib/permissions';
import { api } from '@/services/api';
import { confirmSensitiveAction } from '@/services/biometric';

const LABELS: Record<(typeof SCENARIOS)[number], string> = {
  'device-offline': 'Device goes offline',
  'low-battery': 'Low battery',
  reconnect: 'Device reconnects',
  'firmware-update': 'Firmware update',
};

export default function Simulation() {
  const qc = useQueryClient();
  const { active } = useOrg();
  const allowed = !!active && uiCan(active.role, 'simulation.advance');
  const status = useQuery({
    queryKey: ['simulation-status', active?.orgId],
    enabled: allowed,
    queryFn: () => api.get<{ data: { enabled: boolean } }>(`/api/simulation?orgId=${encodeURIComponent(active!.orgId)}`),
    retry: false,
  });
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!allowed) return <Empty text="Only owners and administrators can use the simulation area." />;
  if (status.isLoading) return <Loading />;
  if (status.isError || !status.data?.data.enabled) return <Empty text="The simulation area is not enabled for this deployment." />;

  const send = async (input: unknown, sensitive = false) => {
    const parsed = simulationInput.safeParse(input);
    if (!parsed.success) return setMsg({ kind: 'error', text: 'Invalid simulation request.' });
    setBusy(true);
    setMsg(null);
    try {
      if (sensitive) await confirmSensitiveAction('Confirm resetting demo data');
      await api.post('/api/simulation', parsed.data);
      await qc.invalidateQueries();
      setMsg({ kind: 'success', text: 'Done.' });
    } catch (e) {
      setMsg({ kind: 'error', text: toUserMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Simulation">
      <Message kind={msg?.kind} text={msg?.text ?? null} />
      <Card>
        <Text style={s.itemTitle}>Scenarios</Text>
        {SCENARIOS.map((sc) => (
          <Button key={sc} label={LABELS[sc]} variant="secondary" busy={busy} onPress={() => void send({ orgId: active.orgId, action: 'scenario', scenario: sc })} />
        ))}
      </Card>
      <Card>
        <Button label="Advance 1 step" busy={busy} onPress={() => void send({ orgId: active.orgId, action: 'advance', steps: 1 })} />
        <Button label="Advance 10 steps" variant="secondary" busy={busy} onPress={() => void send({ orgId: active.orgId, action: 'advance', steps: 10 })} />
      </Card>
      <Card>
        <Text style={s.muted}>Resets this organization's demo devices, readings and events.</Text>
        <Button label="Reset demo data" variant="danger" busy={busy} onPress={() => void send({ orgId: active.orgId, action: 'reset' }, true)} />
      </Card>
    </Screen>
  );
}
