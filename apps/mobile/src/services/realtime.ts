/**
 * Supabase Realtime for live device state.
 * - PRD: pause updates in the background, resume when the app is active and the connection returns.
 *   No Android background service is used (T5646/T5645): subscriptions live only while foregrounded.
 * - T5657: every payload is validated with a strict schema; malformed messages are dropped.
 * - T378: postgres_changes respect RLS, so subscribers only receive their organization's rows.
 * - Transport is wss:// only (T146) because the Supabase URL is validated as https.
 */
import NetInfo from '@react-native-community/netinfo';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { AppState, type AppStateStatus } from 'react-native';
import { z } from 'zod';

import { supabase } from './supabase';

const Scalar = z.union([z.number().finite(), z.boolean()]);
export const DeviceStateChange = z
  .object({
    device_id: z.string().uuid(),
    org_id: z.string().uuid(),
    desired: z.record(Scalar).nullable(),
    reported: z.record(Scalar).nullable(),
    desired_version: z.number().int().nonnegative(),
    updated_at: z.string().datetime({ offset: true }),
  })
  .passthrough()
  .transform(({ device_id, org_id, desired, reported, desired_version, updated_at }) => ({
    deviceId: device_id,
    orgId: org_id,
    desired,
    reported,
    desiredVersion: desired_version,
    updatedAt: updated_at,
  }));
export type DeviceStateChange = z.infer<typeof DeviceStateChange>;

type Listener = (change: DeviceStateChange) => void;

let channel: RealtimeChannel | null = null;
let activeOrg: string | null = null;
const listeners = new Set<Listener>();
let appState: AppStateStatus = AppState.currentState;
let online = true;

function subscribe() {
  if (channel || !activeOrg || appState !== 'active' || !online) return;
  channel = supabase
    .channel(`device-state:${activeOrg}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'device_state', filter: `org_id=eq.${activeOrg}` }, (msg) => {
      try {
        const parsed = DeviceStateChange.safeParse(msg.new);
        if (!parsed.success || parsed.data.orgId !== activeOrg) return; // drop malformed / foreign rows
        listeners.forEach((l) => l(parsed.data));
      } catch {
        /* never crash on a bad message */
      }
    })
    .subscribe();
}

async function unsubscribe() {
  if (channel) {
    const c = channel;
    channel = null;
    await supabase.removeChannel(c);
  }
}

AppState.addEventListener('change', (next) => {
  appState = next;
  if (next === 'active') subscribe();
  else void unsubscribe(); // pause in background
});

NetInfo.addEventListener((s) => {
  online = !!s.isConnected;
  if (online) subscribe();
  else void unsubscribe();
});

export const realtime = {
  setOrganization(orgId: string | null) {
    if (orgId === activeOrg) return;
    void unsubscribe().then(() => {
      activeOrg = orgId && z.string().uuid().safeParse(orgId).success ? orgId : null;
      subscribe();
    });
  },
  onDeviceState(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Closes everything (logout — T164). */
  async stopAll() {
    activeOrg = null;
    listeners.clear();
    await unsubscribe();
    await supabase.removeAllChannels();
  },
};
