/**
 * Transport policy helpers (T21, T146, T2599).
 *
 * Every configured base URL must be HTTPS. Plain HTTP is accepted only for localhost while not in
 * production. URLs are parsed (never concatenated) and reduced to their origin so a configured value
 * can't smuggle extra paths, credentials or query parameters.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function requireHttpsOrigin(value: string | undefined, name: string, isProduction: boolean): string {
  if (!value) throw new Error(`${name} is required`);
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
  if (u.username || u.password) throw new Error(`${name} must not embed credentials`);
  const localDev = !isProduction && LOCAL_HOSTS.has(u.hostname);
  if (u.protocol !== 'https:' && !(localDev && u.protocol === 'http:')) {
    throw new Error(`${name} must use https`);
  }
  return u.origin;
}

/** Build an absolute URL from a fixed base and a path template — the base is never request-derived. */
export function joinPath(origin: string, path: string): string {
  if (!path.startsWith('/') || path.includes('..') || path.includes('//')) {
    throw new Error('invalid path');
  }
  return new URL(path, origin).toString();
}
