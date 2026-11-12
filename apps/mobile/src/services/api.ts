/**
 * Client for the ACME IoT API on Vercel.
 * - T146/T21: https only; the base URL is validated at startup and each request URL is re-checked.
 * - Bearer token in the Authorization header (never in query strings, never cookies → no CSRF surface, T29).
 * - T164: a 401 triggers the full logout cleanup.
 * - PRD: control actions require a connection — mutations fail fast when offline (no queued replays).
 * - T145: the client never sends role/org claims; the server derives them from the JWT + memberships.
 */
import NetInfo from '@react-native-community/netinfo';

import { env } from '@/config/env';
import { UserFacingError } from '@/lib/errors';
import { logout } from './session';
import { currentAccessToken } from './supabase';

const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

async function request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  if (!path.startsWith('/api/')) throw new Error('Invalid API path');
  const url = new URL(path, env.apiBaseUrl);
  if (url.protocol !== 'https:' || url.origin !== env.apiBaseUrl) throw new Error('Insecure transport blocked');

  if (method !== 'GET') {
    const net = await NetInfo.fetch();
    if (!net.isConnected) throw new UserFacingError('You are offline. Control actions need a connection.');
  }

  const token = await currentAccessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      redirect: 'error',
      credentials: 'omit',
    });
    if (res.status === 401) {
      await logout('expired');
      throw new UserFacingError('Your session has expired. Please sign in again.');
    }
    if (res.status === 403) throw new UserFacingError('You do not have permission to do this.');
    if (res.status === 429) throw new UserFacingError('Too many requests. Please wait a moment.');
    if (!res.ok) {
      // API error envelope: { error: { code, requestId } } — never contains internals.
      const code = await res
        .json()
        .then((j: { error?: { code?: unknown } }) => (typeof j.error?.code === 'string' ? j.error.code : 'error'))
        .catch(() => 'error');
      throw new ApiError(res.status, String(code).slice(0, 64));
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
