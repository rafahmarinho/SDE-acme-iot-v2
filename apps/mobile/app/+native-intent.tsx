/**
 * Filters every incoming deep link / universal link before Expo Router handles it (T170/T273).
 * - Unknown paths go to '/'.
 * - Query parameters are dropped, except the one-time PKCE `code` on /reset-password.
 * - Links can only navigate; screens require an authenticated session and never perform an action
 *   (device control, registration, firmware) from link data without explicit in-app confirmation.
 */
import { safeInternalPath } from '@/lib/safeRoutes';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, 'acmeiot://app');
    // For custom-scheme links the "host" is the first path segment (acmeiot://reset-password).
    const pathname = url.protocol === 'acmeiot:' && url.host ? `/${url.host}${url.pathname === '/' ? '' : url.pathname}` : url.pathname;
    const safe = safeInternalPath(pathname);
    if (safe === '/reset-password') {
      const code = url.searchParams.get('code');
      return code && /^[A-Za-z0-9-]{8,128}$/.test(code) ? `/reset-password?code=${encodeURIComponent(code)}` : '/reset-password';
    }
    return safe;
  } catch {
    return '/';
  }
}
