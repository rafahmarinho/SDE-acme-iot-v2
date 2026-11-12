/**
 * Authentication and authorization middleware (T17, T338, T29, T378, T2139).
 *
 * Authentication
 *  - ONLY `Authorization: Bearer <Supabase access token>` is accepted. Cookies are never read for
 *    authentication, and a request that presents a session cookie instead of a bearer token is
 *    rejected — this makes cross-site request forgery structurally impossible (T29). If cookie
 *    sessions are ever introduced (e.g. SSR), they MUST use SameSite=Strict + Secure + HttpOnly and
 *    a per-session double-submit CSRF token.
 *  - The token is verified with Supabase Auth on every request (signature, expiry, revocation).
 *
 * Authorization (server-side, deny by default)
 *  - `requireRole` / `requirePermission` look up the caller's membership through the user-scoped
 *    client (RLS applies) and refuse unless the role is in the permission matrix.
 *  - Client-side role checks in apps/mobile are UI hints only.
 */
import { can, isRole, rolesFor, type Permission, type Role } from '@acme-iot/shared';
import { HttpError } from '../lib/errors';
import type { Ctx } from '../lib/http';
import { supabaseAnon, supabaseForUser } from '../lib/supabase';

const BEARER = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/;

export async function authenticateUser(req: Request): Promise<{ id: string; accessToken: string }> {
  const header = req.headers.get('authorization');
  const match = header ? BEARER.exec(header) : null;
  if (!match?.[1]) {
    // Explicitly refuse ambient-credential (cookie) auth attempts.
    if (req.headers.get('cookie')?.includes('sb-')) throw new HttpError(401, 'bearer_token_required');
    throw new HttpError(401, 'unauthenticated');
  }
  const accessToken = match[1];
  if (accessToken.length > 4096) throw new HttpError(401, 'unauthenticated');
  const { data, error } = await supabaseAnon().auth.getUser(accessToken);
  if (error || !data.user) throw new HttpError(401, 'unauthenticated');
  return { id: data.user.id, accessToken };
}

/** Resolve the caller's role in `orgId`, or null when not a member. RLS limits rows to own memberships. */
export async function getRole(ctx: Ctx, orgId: string): Promise<Role | null> {
  if (!ctx.user) throw new HttpError(401, 'unauthenticated');
  const { data, error } = await supabaseForUser(ctx.user.accessToken)
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', ctx.user.id)
    .maybeSingle();
  if (error) throw new HttpError(500, 'internal_error');
  const role = (data as { role?: unknown } | null)?.role;
  return isRole(role) ? role : null;
}

/**
 * Require one of `roles` in `orgId`. Non-members get 404 (no existence oracle for other orgs' data);
 * members without the role get 403.
 */
export async function requireRole(ctx: Ctx, orgId: string, roles: readonly Role[]): Promise<Role> {
  const role = await getRole(ctx, orgId);
  if (!role) throw new HttpError(404, 'not_found');
  if (!roles.includes(role)) throw new HttpError(403, 'forbidden');
  return role;
}

/** Require a named permission from the shared matrix (preferred over raw role lists). */
export async function requirePermission(ctx: Ctx, orgId: string, action: Permission): Promise<Role> {
  const role = await requireRole(ctx, orgId, rolesFor(action));
  if (!can(role, action)) throw new HttpError(403, 'forbidden');
  return role;
}
