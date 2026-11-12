/**
 * UI adaptation by role (PRD: "Adapte a navegação aos perfis de usuário").
 * T145/T17: this ONLY hides or disables controls. Every action is authorized again by the API
 * (requirePermission) and by Supabase RLS; the app never sends a role to the server and the server never
 * trusts one. Treat the app binary as attacker-controlled.
 */
import { can, isRole, type Permission, type Role } from '@acme-iot/shared';

export type { Permission, Role };

export function uiCan(role: Role | null | undefined, action: Permission): boolean {
  return can(role, action);
}

export function parseRole(value: unknown): Role | null {
  return isRole(value) ? value : null;
}
