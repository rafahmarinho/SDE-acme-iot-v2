/**
 * `route()` — the only way to build an API handler (see docs/security-contract.md §2).
 *
 * Pipeline, in order:
 *   1. security headers (HSTS, CSP 'none', frame-ancestors 'none', nosniff, no-store)    T21 T66 T166
 *   2. HTTPS enforcement in production (x-forwarded-proto)                               T21
 *   3. CORS exact allow-list; OPTIONS preflight                                           T257
 *   4. method allow-list (405 otherwise)                                                  T42
 *   5. request-line / header limits (URL length, header count/size)                      T35 T536
 *   6. Content-Type: application/json required for bodies (blocks form-post CSRF)          T29
 *   7. body size limit, enforced while streaming (413)                                     T536
 *   8. authentication: bearer JWT (user) | HMAC-signed (device) | none (explicit)          T338 T69
 *   9. rate limiting via Postgres (429 + Retry-After)                                     T1362
 *  10. handler
 *  11. generic error mapping — no stack traces or DB details in responses                  T2139 T49
 *
 * Usage in a Vercel function file (Web-standard handlers):
 *   const handler = route({ methods: ['GET', 'POST'], auth: 'user' }, async (ctx) => { ... });
 *   export { handler as GET, handler as POST, handler as OPTIONS };
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ZodError, type ZodType, type ZodTypeDef } from 'zod';
import { HttpError } from './errors';
import { env } from './env';
import { newRequestId } from './crypto';
import { log } from './audit';
import { supabaseAdmin, supabaseAnon, supabaseForUser } from './supabase';
import { applySecurityHeaders } from '../middleware/securityHeaders';
import { applyCors, preflight } from '../middleware/cors';
import { authenticateUser } from '../middleware/auth';
import { authenticateSystem } from '../middleware/systemAuth';
import { consume, LIMITS, RateLimitError } from '../middleware/rateLimit';

export { HttpError } from './errors';

export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type AuthMode = 'user' | 'device' | 'none';

export interface Ctx {
  req: Request;
  requestId: string;
  ip: string;
  /** Present when auth = 'user'. */
  user?: { id: string; accessToken: string };
  /** Present when auth = 'device' (signed system request). */
  device?: { principalId: string };
  /** User-scoped client (RLS) for auth='user'; service-role client for 'device'; anon for 'none'. */
  db: SupabaseClient;
  /** Raw request body (already size-checked). Empty string when there is no body. */
  bodyText: string;
}

export interface RouteOptions {
  methods: Method[];
  auth: AuthMode;
  /** Max request body in bytes. Default 16 KiB. Use `BODY_LIMITS`. */
  maxBodyBytes?: number;
  /** Throttle per user (auth=user) or per IP (otherwise). Default: LIMITS.default. */
  rateLimit?: { limit: number; windowSec: number };
  /** Stable name for rate-limit keys and logs (defaults to the URL path). */
  name?: string;
}

/** Per-route body limits in one place (T536). */
export const BODY_LIMITS = {
  none: 0,
  command: 2_048,
  small: 4_096,
  default: 16_384,
  automation: 16_384,
  simulation: 8_192,
  firmwareMeta: 8_192,
} as const;

const MAX_URL_LENGTH = 2_048;
const MAX_HEADER_COUNT = 64;
const MAX_HEADER_BYTES = 16_384;

/** JSON response — always an object body (never a top-level array), with security headers (T166). */
export function json(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  if (Array.isArray(data)) throw new Error('json(): wrap arrays in an object, e.g. { data: [...] }');
  const headers = applySecurityHeaders(new Headers(extraHeaders));
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data ?? {}), { status, headers });
}

/** Parse and validate the (already size-limited) body against an allow-list schema. */
export async function readJson<T>(ctx: Ctx, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  if (!ctx.bodyText) throw new HttpError(400, 'body_required');
  let parsed: unknown;
  try {
    parsed = JSON.parse(ctx.bodyText);
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
  return schema.parse(parsed);
}

/** Validate query-string parameters against an allow-list schema (T42). */
export function readQuery<T>(ctx: Ctx, schema: ZodType<T, ZodTypeDef, unknown>): T {
  const params = Object.fromEntries(new URL(ctx.req.url).searchParams.entries());
  return schema.parse(params);
}

function clientIp(req: Request): string {
  const real = req.headers.get('x-real-ip');
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = real ?? fwd ?? 'unknown';
  return /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : 'unknown';
}

async function readBodyLimited(req: Request, maxBytes: number): Promise<string> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413, 'payload_too_large');
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, 'payload_too_large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function errorResponse(err: unknown, requestId: string, cors: (h: Headers) => void): Response {
  const headers = new Headers();
  cors(headers);
  if (err instanceof RateLimitError) {
    headers.set('Retry-After', String(err.retryAfterSec));
    return json({ error: { code: err.code, requestId } }, 429, headers);
  }
  if (err instanceof HttpError) {
    return json({ error: { code: err.code, requestId } }, err.status, headers);
  }
  if (err instanceof ZodError) {
    // Only field paths are returned — not values or internal messages.
    const fields = [...new Set(err.issues.map((i) => i.path.join('.') || '(root)'))].slice(0, 20);
    return json({ error: { code: 'invalid_request', requestId, fields } }, 400, headers);
  }
  log('error', 'unhandled_error', {
    requestId,
    name: err instanceof Error ? err.name : 'unknown',
    message: err instanceof Error ? err.message : String(err),
  });
  const body: Record<string, unknown> = { error: { code: 'internal_error', requestId } };
  if (env.debugErrors && err instanceof Error) body.debug = err.message; // never in production (T49)
  return json(body, 500, headers);
}

export function route(opts: RouteOptions, handler: (ctx: Ctx) => Promise<Response>): (req: Request) => Promise<Response> {
  if (opts.methods.length === 0) throw new Error('route(): at least one method is required');
  const maxBodyBytes = opts.maxBodyBytes ?? BODY_LIMITS.default;
  const limit = opts.rateLimit ?? LIMITS.default;

  return async (req: Request): Promise<Response> => {
    const requestId = newRequestId();
    const ip = clientIp(req);
    const withCors = (h: Headers) => applyCors(req, h, opts.methods);

    try {
      if (env.isProduction && req.headers.get('x-forwarded-proto') === 'http') {
        throw new HttpError(400, 'https_required');
      }

      const method = req.method.toUpperCase();
      if (method === 'OPTIONS') return preflight(req, applySecurityHeaders(new Headers()), opts.methods);
      if (!(opts.methods as string[]).includes(method)) {
        const h = new Headers({ Allow: opts.methods.join(', ') });
        withCors(h);
        return json({ error: { code: 'method_not_allowed', requestId } }, 405, h);
      }

      // Request-line and header limits (application-level part of T35).
      if (req.url.length > MAX_URL_LENGTH) throw new HttpError(414, 'uri_too_long');
      let headerCount = 0;
      let headerBytes = 0;
      req.headers.forEach((v, k) => {
        headerCount += 1;
        headerBytes += k.length + v.length;
      });
      if (headerCount > MAX_HEADER_COUNT || headerBytes > MAX_HEADER_BYTES) throw new HttpError(431, 'headers_too_large');

      // Bodies: JSON only, size-limited. GET/DELETE must not carry bodies (no state change on GET).
      let bodyText = '';
      if (method === 'POST' || method === 'PATCH') {
        const ct = req.headers.get('content-type') ?? '';
        if (!/^application\/json(;\s*charset=utf-8)?$/i.test(ct.trim())) throw new HttpError(415, 'json_required');
        bodyText = await readBodyLimited(req, maxBodyBytes);
      } else if (Number(req.headers.get('content-length') ?? '0') > 0) {
        throw new HttpError(400, 'unexpected_body');
      }

      const ctx: Ctx = { req, requestId, ip, db: supabaseAnon(), bodyText };
      if (opts.auth === 'user') {
        ctx.user = await authenticateUser(req);
        ctx.db = supabaseForUser(ctx.user.accessToken);
      } else if (opts.auth === 'device') {
        ctx.device = await authenticateSystem(req, bodyText, ip);
        ctx.db = supabaseAdmin();
      }

      const name = opts.name ?? new URL(req.url).pathname.replace(/[0-9a-f-]{36}/gi, ':id');
      const who = ctx.user?.id ?? ctx.device?.principalId ?? `ip:${ip}`;
      await consume(`rl:${name}:${who}`, limit.limit, limit.windowSec);

      const res = await handler(ctx);
      const headers = new Headers(res.headers);
      applySecurityHeaders(headers);
      withCors(headers);
      return new Response(res.body, { status: res.status, headers });
    } catch (err) {
      return errorResponse(err, requestId, withCors);
    }
  };
}
