/**
 * Supabase clients for the API (T19, T248, T2599, T378).
 *
 * - `supabaseForUser(token)`: anon key + the caller's JWT, so Postgres RLS applies to every query.
 *   This is the default for request handling.
 * - `supabaseAdmin()`: service role, bypasses RLS. Only for system jobs (rate limiting, device
 *   simulator callbacks, firmware signing bookkeeping). Callers MUST check org membership first.
 *
 * Both use the single fixed `SUPABASE_URL` origin from env — tenant selection happens in queries
 * (`org_id` + RLS), never by switching connections (T2599).
 * Server-only: this module throws if it is ever evaluated in a browser / React Native bundle.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

if (typeof (globalThis as { window?: unknown }).window !== 'undefined' ||
    (globalThis as { navigator?: { product?: string } }).navigator?.product === 'ReactNative') {
  throw new Error('apps/api/src/lib/supabase.ts is server-only and must not be bundled into a client');
}

const SERVER_AUTH = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export function supabaseForUser(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: SERVER_AUTH,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** Anonymous client (no user) — used only to verify access tokens. */
export function supabaseAnon(): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: SERVER_AUTH });
}

let admin: SupabaseClient | undefined;
export function supabaseAdmin(): SupabaseClient {
  admin ??= createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: SERVER_AUTH });
  return admin;
}
