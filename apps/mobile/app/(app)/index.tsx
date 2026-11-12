/** Dashboard: org selector, device cards, offline banner and role-adapted navigation (UX only — T145). */
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { DeviceCard } from '@/components/DeviceCard';
import { Card, Empty, Loading, Message, Screen, s } from '@/components/ui';
import { useDevices } from '@/hooks/useDevices';
import { useOrg } from '@/hooks/useOrg';
import { uiCan, type Permission } from '@/lib/permissions';
import { colors, space } from '@/theme';

const NAV: { label: string; href: string; permission: Permission }[] = [
  { label: 'Buildings', href: '/buildings', permission: 'building.read' },
  { label: 'Register device', href: '/devices/new', permission: 'device.register' },
  { label: 'Automations', href: '/automations', permission: 'automation.read' },
  { label: 'Alerts', href: '/alerts', permission: 'alert.read' },
  { label: 'Events', href: '/events', permission: 'event.read' },
  { label: 'Firmware', href: '/firmware', permission: 'firmware.read' },
  { label: 'Integrations', href: '/integrations', permission: 'integration.read' },
  { label: 'Team', href: '/team', permission: 'team.read' },
  { label: 'Simulation', href: '/simulation', permission: 'simulation.view' },
  { label: 'Profile', href: '/profile', permission: 'org.read' },
  { label: 'Settings', href: '/settings', permission: 'org.read' },
];

export default function Dashboard() {
  const { memberships, active, select, loading } = useOrg();
  const devices = useDevices(active?.orgId);

  if (loading) return <Loading />;
  if (!active) return <Empty text="You are not a member of any organization yet. Ask an administrator to invite you." />;

  const list = devices.data?.devices ?? [];
  const offline = devices.data?.offlineSince ?? null;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {memberships.map((m) => (
          <Pressable
            key={m.orgId}
            onPress={() => select(m.orgId)}
            style={{ padding: space.sm, borderRadius: 8, backgroundColor: m.orgId === active.orgId ? colors.primary : colors.primarySoft }}
          >
            <Text style={{ color: m.orgId === active.orgId ? '#fff' : colors.primary }}>{m.orgName}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.muted}>Your role: {active.role}</Text>
      {offline ? (
        <Message kind="error" text={`Offline — showing data saved at ${new Date(offline).toLocaleString()}. Controls are disabled.`} />
      ) : null}
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {NAV.filter((n) => uiCan(active.role, n.permission)).map((n) => (
            <Pressable key={n.href} onPress={() => router.push(n.href as never)} style={{ padding: space.sm }}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>{n.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      {devices.isLoading ? <Loading label="Loading devices…" /> : null}
      {devices.isError ? <Message kind="error" text="Could not load devices." /> : null}
      {list.length === 0 && !devices.isLoading ? <Empty text="No devices yet." /> : null}
      {list.map((d) => (
        <DeviceCard key={d.id} device={d} onPress={() => router.push({ pathname: '/devices/[id]', params: { id: d.id } })} />
      ))}
    </Screen>
  );
}
