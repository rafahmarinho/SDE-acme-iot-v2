/**
 * Allow-lists for navigation input that comes from outside the app:
 * redirect params (T37), deep links / universal links (T170/T273) and push notification taps (T5657).
 * Incoming data can only NAVIGATE to a known screen; it never triggers an action.
 */
import { z } from 'zod';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_PATHS: RegExp[] = [
  /^\/$/,
  /^\/buildings$/,
  /^\/rooms\/[0-9a-f-]{36}$/,
  /^\/devices\/new$/,
  /^\/devices\/[0-9a-f-]{36}$/,
  /^\/automations$/,
  /^\/alerts$/,
  /^\/events$/,
  /^\/firmware$/,
  /^\/settings$/,
  /^\/profile$/,
  /^\/reset-password$/,
];

/** Returns an internal path that is safe to navigate to, or '/' (query string and fragment dropped). */
export function safeInternalPath(candidate: unknown): string {
  if (typeof candidate !== 'string' || candidate.length > 200) return '/';
  // Reject absolute / protocol-relative URLs and backslash tricks before parsing.
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return '/';
  let pathname: string;
  try {
    pathname = new URL(candidate, 'https://app.invalid').pathname;
  } catch {
    return '/';
  }
  return ALLOWED_PATHS.some((re) => re.test(pathname)) ? pathname : '/';
}

/** Push notification payload (T5657): only these kinds/ids are accepted, everything else is dropped. */
export const NotificationData = z
  .object({ kind: z.enum(['alert', 'automation', 'firmware']), id: z.string().regex(UUID) })
  .strict();

export function routeForNotification(data: unknown): string | null {
  const parsed = NotificationData.safeParse(data);
  if (!parsed.success) return null;
  switch (parsed.data.kind) {
    case 'alert':
      return '/alerts';
    case 'automation':
      return '/automations';
    case 'firmware':
      return '/firmware';
  }
}

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
