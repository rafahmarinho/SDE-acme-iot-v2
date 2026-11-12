/**
 * Response DTO allow-lists (T2139).
 *
 * The API never returns raw database rows and never uses `select('*')`. Each resource has an explicit
 * column list used in the query AND an output mapper that copies only those fields.
 */
export const COLUMNS = {
  organization: 'id, name',
  building: 'id, org_id, name',
  room: 'id, org_id, building_id, name',
  device:
    'id, org_id, room_id, type, name, firmware_version, online, battery_pct, last_seen_at',
  deviceState: 'device_id, desired, reported, desired_version, updated_at',
  reading: 'id, device_id, metric, value, recorded_at',
  automation: 'id, org_id, name, condition, action, cooldown_seconds, enabled, last_run_at',
  automationRun: 'id, automation_id, status, detail, ran_at',
  alert: 'id, device_id, severity, message, acknowledged_at',
  event: 'id, kind, device_id, payload, created_at',
  firmwareRelease: 'id, device_type, version, sha256, created_at',
  firmwareRollout: 'id, release_id, device_id, status, progress, previous_version, updated_at',
  integration: 'id, kind, name, target_host, enabled',
  member: 'user_id, role',
  profile: 'user_id, display_name, locale, updated_at',
} as const;

export type ColumnSet = keyof typeof COLUMNS;

/** Fields of a column set, as an array (for mappers). */
export function fieldsOf(set: ColumnSet): string[] {
  return COLUMNS[set].split(',').map((s) => s.trim());
}

/** Copy only allow-listed keys from `row`. Unknown/sensitive columns are dropped. */
export function pick<T extends Record<string, unknown>, K extends string>(
  row: T,
  keys: readonly K[],
): { [P in K]: P extends keyof T ? T[P] : undefined } {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(row, k)) out[k] = row[k];
  }
  return out as { [P in K]: P extends keyof T ? T[P] : undefined };
}

/** Map rows of a known resource to their DTO. */
export function toDto<T extends Record<string, unknown>>(set: ColumnSet, row: T): Record<string, unknown> {
  return pick(row, fieldsOf(set));
}
