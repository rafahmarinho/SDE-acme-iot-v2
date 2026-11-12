/**
 * Small request helpers for feature routes: validated path/query parameters only.
 */
import { z, type ZodType } from 'zod';
import { HttpError } from '../lib/http';

const UUID = z.string().uuid();

/** UUID path segment located right after `after` (e.g. /api/devices/<id>/command). */
export function uuidAfter(req: Request, after: string): string {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  const i = parts.indexOf(after);
  const parsed = UUID.safeParse(i >= 0 ? parts[i + 1] : undefined);
  if (!parsed.success) throw new HttpError(404, 'not_found');
  return parsed.data;
}

/** Parse query parameters with a strict allow-list schema. */
export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw new HttpError(400, 'invalid_query');
  return parsed.data;
}

/** Escape LIKE wildcards so a search term is matched literally (value itself is a bound parameter). */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Opaque, bounded offset cursor. */
export function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  const n = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (!Number.isInteger(n) || n < 0 || n > 10_000) throw new HttpError(400, 'invalid_cursor');
  return n;
}

export function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), 'utf8').toString('base64url');
}
