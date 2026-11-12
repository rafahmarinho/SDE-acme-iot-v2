/**
 * Device card: name, type, desired vs reported state, battery and online status.
 * Device-provided values (name, reported state) are untrusted and rendered only as <Text> (T36).
 * No serial numbers or registration codes are displayed (T161).
 */
import { Pressable, Text, View } from 'react-native';

import { colors, space } from '@/theme';
import { Highlight, s } from './ui';

export type DeviceSummary = {
  id: string;
  name: string;
  type: string;
  online: boolean;
  batteryPct: number | null;
  desired: Record<string, number | boolean> | null;
  reported: Record<string, number | boolean> | null;
};

const TYPE_LABEL: Record<string, string> = {
  thermostat: 'Thermostat',
  smart_plug: 'Smart plug',
  temperature_sensor: 'Temperature sensor',
  humidity_sensor: 'Humidity sensor',
  occupancy_sensor: 'Occupancy sensor',
};

function fmt(state: Record<string, number | boolean> | null): string {
  if (!state) return '—';
  return Object.entries(state)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${typeof v === 'boolean' ? (v ? 'on' : 'off') : Number(v).toFixed(1)}`)
    .join(' · ');
}

export function DeviceCard({ device, query = '', onPress }: { device: DeviceSummary; query?: string; onPress?: () => void }) {
  const lowBattery = device.batteryPct !== null && device.batteryPct < 20;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={s.card}>
      <View style={s.row}>
        <Highlight text={device.name} query={query} />
        <Text style={{ color: device.online ? colors.success : colors.danger, fontWeight: '600' }}>
          {device.online ? 'Online' : 'Offline'}
        </Text>
      </View>
      <Text style={s.muted}>{TYPE_LABEL[device.type] ?? 'Device'}</Text>
      <View style={{ gap: space.xs }}>
        <Text style={s.muted}>Desired: {fmt(device.desired)}</Text>
        <Text style={s.muted}>Reported: {fmt(device.reported)}</Text>
      </View>
      {device.batteryPct !== null ? (
        <Text style={{ color: lowBattery ? colors.warning : colors.muted }}>
          Battery {device.batteryPct}%{lowBattery ? ' — low' : ''}
        </Text>
      ) : null}
    </Pressable>
  );
}
