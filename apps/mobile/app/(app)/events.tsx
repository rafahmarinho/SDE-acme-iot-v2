/** Events log (read-only, append-only table; bounded page). Payload values are shown as text only (T36). */
import { useQuery } from '@tanstack/react-query';
import { Text } from 'react-native';

import { Card, Empty, Loading, Screen, s } from '@/components/ui';
import { useOrg } from '@/hooks/useOrg';
import { supabase } from '@/services/supabase';

export default function Events() {
  const { active } = useOrg();
  const q = useQuery({
    queryKey: ['events', active?.orgId],
    enabled: !!active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, kind, device_id, created_at')
        .eq('org_id', active!.orgId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!active) return <Empty text="Select an organization first." />;
  return (
    <Screen title="Events">
      {q.isLoading ? <Loading /> : null}
      {q.data?.length === 0 ? <Empty text="No events yet." /> : null}
      {(q.data ?? []).map((e) => (
        <Card key={e.id}>
          <Text style={s.itemTitle}>{e.kind}</Text>
          <Text style={s.muted}>{new Date(e.created_at).toLocaleString()}</Text>
        </Card>
      ))}
    </Screen>
  );
}
