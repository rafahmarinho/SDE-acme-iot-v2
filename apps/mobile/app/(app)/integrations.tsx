/**
 * Simulated external integrations. Visible to owner/admin only (`integration.read`); configuration
 * secrets never reach the client — only name, kind, target host and status are selected.
 */
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { Card, Empty, Loading, Screen, s } from '@/components/ui';
import { useOrg } from '@/hooks/useOrg';
import { uiCan } from '@/lib/permissions';
import { supabase } from '@/services/supabase';

export default function Integrations() {
  const { active } = useOrg();
  const allowed = !!active && uiCan(active.role, 'integration.read');
  const q = useQuery({
    queryKey: ['integrations', active?.orgId],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integrations')
        .select('id, kind, name, target_host, enabled')
        .eq('org_id', active!.orgId)
        .order('name')
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!allowed) return <Empty text="Only owners and administrators can view integrations." />;
  return (
    <Screen title="Integrations">
      {q.isLoading ? <Loading /> : null}
      {q.data?.length === 0 ? <Empty text="No integrations configured." /> : null}
      {(q.data ?? []).map((i) => (
        <Card key={i.id}>
          <View style={s.row}>
            <Text style={s.itemTitle}>{i.name}</Text>
            <Text style={s.muted}>{i.enabled ? 'Enabled' : 'Disabled'}</Text>
          </View>
          <Text style={s.muted}>{i.kind} · {i.target_host}</Text>
        </Card>
      ))}
    </Screen>
  );
}
