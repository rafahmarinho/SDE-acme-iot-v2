/**
 * Strict CORS (T257).
 *
 * - Exact-match allow-list from `ALLOWED_ORIGINS` (validated in env.ts: https, no wildcards).
 * - Unknown origins get NO Access-Control-Allow-Origin header; the origin is never reflected blindly.
 * - No `Access-Control-Allow-Credentials`: the API uses bearer tokens, never cookies (T29).
 * - CORS is not access control: every non-OPTIONS request is still authenticated by route().
 */
import { env } from '../lib/env';

const ALLOWED = new Set(env.ALLOWED_ORIGINS);
const ALLOW_HEADERS = 'Authorization, Content-Type';

export function isAllowedOrigin(origin: string | null): origin is string {
  return origin !== null && ALLOWED.has(origin);
}

export function applyCors(req: Request, headers: Headers, methods: readonly string[]): void {
  headers.append('Vary', 'Origin');
  const origin = req.headers.get('origin');
  if (!isAllowedOrigin(origin)) return;
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(', '));
  headers.set('Access-Control-Allow-Headers', ALLOW_HEADERS);
  headers.set('Access-Control-Max-Age', '600');
}

/** Preflight response. Disallowed origins receive 403 without CORS headers. */
export function preflight(req: Request, headers: Headers, methods: readonly string[]): Response {
  const origin = req.headers.get('origin');
  if (!isAllowedOrigin(origin)) return new Response(null, { status: 403, headers });
  applyCors(req, headers, methods);
  return new Response(null, { status: 204, headers });
}
