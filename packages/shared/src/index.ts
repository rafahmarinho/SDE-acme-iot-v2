/**
 * @acme-iot/shared — domain types, permission matrix, validation schemas, DTO allow-lists and
 * transport/crypto policy shared by the Expo client and the Vercel API.
 *
 * Nothing in this package may import server-only modules or read secrets (T248).
 */
export * from './permissions';
export * from './validation';
export * from './dto';
export * from './url';
export * from './cryptoPolicy';

import type { Role } from './permissions';

export interface Organization { id: string; name: string }
export interface Membership { org_id: string; user_id: string; role: Role }
export interface Building { id: string; org_id: string; name: string }
export interface Room { id: string; org_id: string; building_id: string; name: string }
export interface Device {
  id: string;
  org_id: string;
  room_id: string;
  type: 'thermostat' | 'smart_plug' | 'temperature_sensor' | 'humidity_sensor' | 'occupancy_sensor';
  name: string;
  firmware_version: string | null;
  online: boolean;
  battery_pct: number | null;
  last_seen_at: string | null;
}
export interface DeviceState {
  device_id: string;
  desired: Record<string, unknown>;
  reported: Record<string, unknown>;
  desired_version: number;
  updated_at: string;
}
export interface Reading { id: number; device_id: string; metric: string; value: number; recorded_at: string }
export interface Alert { id: string; device_id: string; severity: 'info' | 'warning' | 'critical'; message: string; acknowledged_at: string | null }
export interface EventRecord { id: number; kind: string; device_id: string | null; payload: Record<string, unknown>; created_at: string }
export interface FirmwareRelease { id: string; device_type: Device['type']; version: string; sha256: string; created_at: string }
export interface FirmwareRollout {
  id: string;
  release_id: string;
  device_id: string;
  status: 'pending' | 'downloading' | 'installing' | 'succeeded' | 'failed' | 'rolled_back';
  progress: number;
  previous_version: string | null;
  updated_at: string;
}

/** Every JSON response body is an object (never a top-level array) — T166. */
export interface ApiSuccess<T> { data: T; nextCursor?: string | null }
export interface ApiError { error: { code: string; requestId: string; fields?: string[] } }
