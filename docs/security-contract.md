# Security Implementation Contract (cross-layer interfaces)

Shared interfaces so the database, API and client layers fit together. Changing a name here means
updating every layer.

## 1. Database (supabase/) — owner: Layer A

All tables live in `public` with `org_id uuid not null` (except `organizations`, `profiles`, `consents`,
`api_rate_limits`). **RLS is enabled on every table.** No `grant ... to anon` on any table.

| Table | Key columns |
|-------|-------------|
| organizations | id uuid pk, name text, created_at |
| memberships | org_id, user_id → auth.users, role text check in ('owner','admin','operator','viewer'), pk(org_id,user_id) |
| profiles | user_id pk → auth.users, display_name text check(length ≤ 80), locale, updated_at |
| buildings / rooms | id, org_id, name (≤ 120); rooms.building_id |
| devices | id, org_id, room_id, type check in ('thermostat','smart_plug','temperature_sensor','humidity_sensor','occupancy_sensor'), name, serial_hash text (never raw serial), firmware_version, online bool, battery_pct int 0-100, last_seen_at |
| device_registration_codes | code_hash text pk (sha256 of code), device_type, serial_hash, expires_at, claimed_at, claimed_org_id |
| device_state | device_id pk, org_id, desired jsonb, reported jsonb, desired_version int, updated_at |
| readings | id bigserial, org_id, device_id, metric text, value numeric, recorded_at |
| automations | id, org_id, name, condition jsonb, action jsonb, cooldown_seconds int check ≥ 60, enabled, last_run_at |
| automation_runs | id, org_id, automation_id, status, detail jsonb, ran_at |
| alerts | id, org_id, device_id, severity, message, acknowledged_at |
| events | id bigserial, org_id, kind, device_id, payload jsonb, created_at — **append-only** |
| firmware_releases | id, org_id, device_type, version, storage_path, sha256, signature (base64 Ed25519), key_id, created_by, created_at |
| firmware_rollouts | id, org_id, release_id, device_id, status in ('pending','downloading','installing','succeeded','failed','rolled_back'), progress 0-100, previous_version, updated_at |
| integrations | id, org_id, kind, name, target_host text (must be in allow-list), enabled |
| audit_log | id bigserial, org_id, actor_id, action, target_type, target_id, metadata jsonb, created_at — **append-only**, select: owner/admin |
| consents | user_id, purpose text, granted bool, policy_version text, updated_at, pk(user_id,purpose) |
| api_rate_limits | key text, window_start timestamptz, count int, pk(key,window_start) — service_role only |

Functions (all `security definer`, `set search_path = ''`):
- `public.has_role(p_org uuid, p_roles text[]) returns boolean` (stable) — current `auth.uid()` membership check.
- `public.consume_rate_limit(p_key text, p_limit int, p_window_seconds int) returns boolean` — execute granted to `service_role` only.
- `public.claim_device(p_org uuid, p_room uuid, p_code text, p_name text) returns uuid` — requires admin/owner, verifies `sha256(code)` against an unexpired, unclaimed registration code; marks it claimed.
- `public.log_audit_event(p_org uuid, p_action text, p_target_type text, p_target_id text, p_metadata jsonb)`.

Role matrix: viewer = read; operator = read + device control + ack alerts; admin = + manage devices/automations/firmware/integrations/team (not owners); owner = everything.

Storage buckets: `firmware` (private, write: service_role only, read: signed URLs from the API), `avatars` (private, path `{user_id}/...`).

Auth config (`supabase/config.toml`): min password length 12 with letters+digits, email confirmations on, secure password change on, refresh-token rotation on with reuse interval 10s, JWT expiry 3600, auth rate limits on.

## 2. API core (apps/api/src, packages/shared) — owner: Layer B

```ts
// apps/api/src/lib/http.ts
export class HttpError extends Error { constructor(public status: number, public code: string) }
export type AuthMode = 'user' | 'device' | 'none';
export interface Ctx { req: Request; requestId: string; ip: string;
  user?: { id: string; accessToken: string }; db: SupabaseClient /* user-scoped when auth=user */ }
export function route(opts: { methods: Array<'GET'|'POST'|'PATCH'|'DELETE'>; auth: AuthMode;
  maxBodyBytes?: number /* default 16 KiB */; rateLimit?: { limit: number; windowSec: number } },
  handler: (ctx: Ctx) => Promise<Response>): (req: Request) => Promise<Response>;
export function json(data: unknown, status?: number): Response;      // adds security headers
export async function readJson<T>(ctx: Ctx, schema: ZodType<T>): Promise<T>;  // size-limited + validated
// apps/api/src/lib/supabase.ts
export function supabaseForUser(accessToken: string): SupabaseClient;  // anon key + user JWT → RLS applies
export function supabaseAdmin(): SupabaseClient;                       // service role; server-only jobs
// apps/api/src/lib/env.ts   — validated env (zod); throws at cold start if missing/insecure
// apps/api/src/lib/audit.ts — export async function audit(ctx, orgId, action, targetType, targetId, meta?)
// apps/api/src/middleware/auth.ts — export async function requireRole(ctx, orgId, roles: Role[]): Promise<void>
```
`route()` order: security headers → CORS (allow-list `ALLOWED_ORIGINS`) → method check → rate limit
(`consume_rate_limit`) → body size → auth → handler → generic error mapping (no stack traces, `requestId` only).

`packages/shared` exports: `Role`, `ROLES`, `can(role, action)`, and zod schemas `uuid`, `registrationCode`
(`/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/`), `setpointCommand`, `plugCommand`, `automationInput`,
`listQuery` (limit 1-100, default 50, cursor), `firmwareReleaseInput`, `profileInput`, `consentInput`.

## 3. API features (apps/api/api/**, apps/api/src/lib/{deviceSimClient,firmwareSigning,notify}.ts) — owner: Layer C
Built only on Layer B primitives. Device simulator traffic: HMAC-SHA256 signed (`DEVICE_SIM_SHARED_SECRET`),
HTTPS, host allow-list (`DEVICE_SIM_BASE_URL`), timeouts, no redirects. Firmware: Ed25519 signatures via `node:crypto`.

## 4. Client (apps/mobile) — owner: Layer D
Uses only `EXPO_PUBLIC_*` env. Session storage: `expo-secure-store` on native, in-memory + sessionStorage-free on web.
Calls the API with `Authorization: Bearer <access_token>` (no cookies → CSRF-safe by design).
Web hosting headers live in `apps/mobile/vercel.json`.
