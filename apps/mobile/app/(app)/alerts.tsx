/** Alerts list. Acknowledge requires `alert.acknowledge` (RLS-enforced update policy). */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { Button, Card, Empty, Loading, Screen, s } from '@/components/ui';
import { useOrg } from '@/hooks/useOrg';
import { uiCan } from '@/lib/permissions';
import { supabase } from '@/services/supabase';
import { colors } from '@/theme';

const SEVERITY_COLOR = { info: colors.muted, warning: colors.warning, critical: colors.danger } as const;

export default function Alerts() {
  const qc = useQueryClient();
  const { active } = useOrg();
  const q = useQuery({
    queryKey: ['alerts', active?.orgId],
    enabled: !!active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('id, severity, message, acknowledged_at, created_at')
        .eq('org_id', active!.orgId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!active) return <Empty text="Select an organization first." />;
  const canAck = uiCan(active.role, 'alert.acknowledge');

  const ack = async (id: string) => {
    await supabase.from('alerts').update({ acknowledged_at: new Date().toISOString() }).eq('id', id).eq('org_id', active.orgId);
    await qc.invalidateQueries({ queryKey: ['alerts', active.orgId] });
  };

  return (
    <Screen title="Alerts">
      {q.isLoading ? <Loading /> : null}
      {q.data?.length === 0 ? <Empty text="No alerts." /> : null}
      {(q.data ?? []).map((a) => (
        <Card key={a.id}>
          <View style={s.row}>
            <Text style={{ color: SEVERITY_COLOR[a.severity as keyof typeof SEVERITY_COLOR] ?? colors.muted, fontWeight: '700' }}>
              {String(a.severity).toUpperCase()}
            </Text>
            <Text style={s.muted}>{new Date(a.created_at).toLocaleString()}</Text>
          </View>
          <Text style={{ color: colors.text }}>{a.message}</Text>
          {!a.acknowledged_at && canAck ? <Button label="Acknowledge" variant="secondary" onPress={() => void ack(a.id)} /> : null}
          {a.acknowledged_at ? <Text style={s.muted}>Acknowledged</Text> : null}
        </Card>
      ))}
    </Screen>
  );
}
