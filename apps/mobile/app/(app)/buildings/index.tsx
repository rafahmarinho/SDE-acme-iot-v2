/** Buildings → rooms, with search (bounded, client-side over at most 100 rows) and type filter. */
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { Card, Empty, Field, Highlight, Loading, Message, Screen, s } from '@/components/ui';
import { useOrg } from '@/hooks/useOrg';
import { supabase } from '@/services/supabase';

export default function Buildings() {
  const { active } = useOrg();
  const [q, setQ] = useState('');
  const query = useQuery({
    queryKey: ['buildings', active?.orgId],
    enabled: !!active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('buildings')
        .select('id, name, rooms(id, name)')
        .eq('org_id', active!.orgId)
        .order('name')
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!active) return <Empty text="Select an organization first." />;
  const term = q.trim().toLowerCase().slice(0, 80);
  const list = (query.data ?? []).filter(
    (b) => !term || b.name.toLowerCase().includes(term) || (b.rooms ?? []).some((r) => r.name.toLowerCase().includes(term)),
  );

  return (
    <Screen title="Buildings">
      <Field label="Search buildings or rooms" value={q} onChangeText={setQ} maxLength={80} autoCorrect={false} />
      {query.isLoading ? <Loading /> : null}
      {query.isError ? <Message kind="error" text="Could not load buildings." /> : null}
      {!query.isLoading && list.length === 0 ? <Empty text="No buildings match your search." /> : null}
      {list.map((b) => (
        <Card key={b.id}>
          <Highlight text={b.name} query={q} />
          {(b.rooms ?? []).map((r) => (
            <Pressable key={r.id} onPress={() => router.push({ pathname: '/rooms/[id]', params: { id: r.id } })}>
              <Text style={s.muted}>
                › <Highlight text={r.name} query={q} />
              </Text>
            </Pressable>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
