/**
 * Device list for the active org with offline fallback.
 * Reads go straight to Supabase (RLS restricts rows to the caller's organizations, T378); queries are
 * bounded (T2600). The last successful result is saved as an allow-listed offline snapshot (T148).
 */
import NetInfo from '@react-native-community/netinfo';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { DeviceSummary } from '@/components/DeviceCard';
import { loadSnapshot, saveSnapshot } from '@/services/offlineCache';
import { queryClient } from '@/services/queryClient';
import { realtime } from '@/services/realtime';
import { supabase } from '@/services/supabase';

export type DeviceRow = DeviceSummary & { roomId: string | null; lastSeenAt: string | null; firmwareVersion: string | null };

const PAGE = 100;

async function fetchDevices(orgId: string): Promise<{ devices: DeviceRow[]; offlineSince: number | null }> {
  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    const snap = await loadSnapshot(orgId);
    return {
      devices: (snap?.devices ?? []).map((d) => ({ ...d, lastSeenAt: d.recordedAt, firmwareVersion: null })),
      offlineSince: snap?.savedAt ?? Date.now(),
    };
  }
  const { data, error } = await supabase
    .from('devices')
    .select('id, name, type, room_id, online, battery_pct, last_seen_at, firmware_version, device_state(desired, reported)')
    .eq('org_id', orgId)
    .order('name')
    .limit(PAGE);
  if (error) throw error;
  const rows = (data ?? []).map((d) => {
    const st = Array.isArray(d.device_state) ? d.device_state[0] : d.device_state;
    return {
      id: d.id,
      name: d.name,
      type: d.type,
      roomId: d.room_id,
      online: !!d.online,
      batteryPct: d.battery_pct ?? null,
      desired: (st?.desired ?? null) as Record<string, number | boolean> | null,
      reported: (st?.reported ?? null) as Record<string, number | boolean> | null,
      lastSeenAt: d.last_seen_at,
      firmwareVersion: d.firmware_version,
    };
  });
  await saveSnapshot(
    orgId,
    rows.map((r) => ({ ...r, room_id: r.roomId, battery_pct: r.batteryPct, recorded_at: r.lastSeenAt })),
  );
  return { devices: rows, offlineSince: null };
}

export function useDevices(orgId: string | undefined) {
  const query = useQuery({
    queryKey: ['devices', orgId],
    queryFn: () => fetchDevices(orgId as string),
    enabled: !!orgId,
  });
  useEffect(
    () =>
      realtime.onDeviceState((change) => {
        if (change.orgId !== orgId) return;
        queryClient.setQueryData<{ devices: DeviceRow[]; offlineSince: number | null }>(['devices', orgId], (prev) =>
          prev
            ? {
                ...prev,
                devices: prev.devices.map((d) =>
                  d.id === change.deviceId ? { ...d, desired: change.desired, reported: change.reported } : d,
                ),
              }
            : prev,
        );
      }),
    [orgId],
  );
  return query;
}
