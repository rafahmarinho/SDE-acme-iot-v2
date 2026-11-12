/**
 * Role / permission matrix (T17, T338, T145).
 *
 * Single source of truth used by:
 *   - the API (`requirePermission` in apps/api/src/middleware/auth.ts) — ENFORCEMENT
 *   - Supabase RLS policies (`public.has_role`) — ENFORCEMENT, mirrors this matrix
 *   - the Expo client — UI adaptation ONLY (hiding screens is never a security control)
 *
 * Deny by default: an action that is not listed here is not permitted for anyone.
 */

export const ROLES = ['owner', 'admin', 'operator', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

const ALL: readonly Role[] = ['owner', 'admin', 'operator', 'viewer'];
const CONTROL: readonly Role[] = ['owner', 'admin', 'operator'];
const MANAGE: readonly Role[] = ['owner', 'admin'];
const OWNER: readonly Role[] = ['owner'];

export const PERMISSIONS = {
  'org.read': ALL,
  'org.update': MANAGE,
  'org.delete': OWNER,

  'building.read': ALL,
  'building.manage': MANAGE,

  'device.read': ALL,
  'device.control': CONTROL,
  'device.register': MANAGE,
  'device.delete': MANAGE,

  'reading.read': ALL,

  'automation.read': ALL,
  'automation.manage': MANAGE,

  'alert.read': ALL,
  'alert.acknowledge': CONTROL,

  'event.read': ALL,

  'firmware.read': ALL,
  'firmware.upload': MANAGE,
  'firmware.rollout': MANAGE,
  'firmware.rollback': MANAGE,

  'integration.read': MANAGE,
  'integration.manage': MANAGE,

  'team.read': ALL,
  'team.read_contact': MANAGE, // e-mail addresses of other members (T2139)
  'team.manage': MANAGE,
  'team.manage_owner': OWNER,

  'audit.read': MANAGE,

  'simulation.view': ALL,
  'simulation.advance': MANAGE,
  'simulation.reset': MANAGE,
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** True when `role` is granted `action`. Unknown roles/actions are denied. */
export function can(role: Role | null | undefined, action: Permission): boolean {
  if (!role || !isRole(role)) return false;
  const allowed: readonly Role[] | undefined = PERMISSIONS[action];
  return allowed !== undefined && allowed.includes(role);
}

/** Roles that hold a permission — used to build `has_role(org, roles[])` checks. */
export function rolesFor(action: Permission): readonly Role[] {
  return PERMISSIONS[action];
}
