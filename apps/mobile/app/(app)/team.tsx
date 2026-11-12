/**
 * Team members and roles. Names come from `profiles` (single source of truth — T742); admins manage
 * roles only, never personal fields. E-mail addresses are not fetched by the client (T2139).
 */
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { Card, Empty, Loading, Screen, s } from '@/components/ui';
import { useOrg } from '@/hooks/useOrg';
import { supabase } from '@/services/supabase';

export default function Team() {
  const { active } = useOrg();
  const q = useQuery({
    queryKey: ['team', active?.orgId],
    enabled: !!active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('user_id, role, profiles(display_name)')
        .eq('org_id', active!.orgId)
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!active) return <Empty text="Select an organization first." />;
  return (
    <Screen title="Team">
      {q.isLoading ? <Loading /> : null}
      {(q.data ?? []).map((m) => {
        const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        return (
          <Card key={m.user_id}>
            <View style={s.row}>
              <Text style={s.itemTitle}>{p?.display_name ?? 'Member'}</Text>
              <Text style={s.muted}>{m.role}</Text>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
