/**
 * Room view with a simple spatial ("3D-style") layout of its devices.
 * Labels are React Native <Text> nodes, never HTML overlays built from device strings (T36).
 * Occupancy history is not shown here; raw occupancy is restricted server-side (T5637).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Empty, Loading, Screen, s } from '@/components/ui';
import { useDevices } from '@/hooks/useDevices';
import { useOrg } from '@/hooks/useOrg';
import { isUuid } from '@/lib/safeRoutes';
import { colors } from '@/theme';

export default function Room() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { active } = useOrg();
  const devices = useDevices(active?.orgId);
  if (!isUuid(id)) return <Empty text="Room not found." />;
  if (devices.isLoading) return <Loading />;
  const inRoom = (devices.data?.devices ?? []).filter((d) => d.roomId === id);

  return (
    <Screen title="Room">
      <View
        style={{
          height: 320,
          borderRadius: 16,
          backgroundColor: colors.primarySoft,
          transform: [{ perspective: 800 }, { rotateX: '35deg' }],
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {inRoom.map((d, i) => (
          <Pressable
            key={d.id}
            onPress={() => router.push({ pathname: '/devices/[id]', params: { id: d.id } })}
            style={{
              position: 'absolute',
              left: `${10 + ((i * 37) % 75)}%`,
              top: `${10 + ((i * 53) % 70)}%`,
              padding: 8,
              borderRadius: 10,
              backgroundColor: d.online ? colors.primary : colors.muted,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>{d.name}</Text>
          </Pressable>
        ))}
      </View>
      {inRoom.length === 0 ? <Empty text="No devices in this room." /> : <Text style={s.muted}>{inRoom.length} devices</Text>}
    </Screen>
  );
}
