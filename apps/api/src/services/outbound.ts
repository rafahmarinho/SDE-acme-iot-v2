/**
 * The single gateway for every outbound HTTP call made by the API (T1365 SSRF, T156 TLS).
 * - https only, host allow-list, resolved IPs must be public
 * - no redirects, hard timeout, response size cap
 * - TLS validation is never relaxed; a private CA (if any) is trusted via NODE_EXTRA_CA_CERTS
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { featureConfig } from './config';

export class OutboundError extends Error {
  constructor(public readonly reason: string) {
    super(`Outbound request blocked: ${reason}`);
  }
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_RESPONSE_BYTES = 256 * 1024;

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === '::' || v === '::1') return true;
  if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('ff')) return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIPv4(mapped[1]) : false;
}

export function isPrivateAddress(ip: string): boolean {
  return isIP(ip) === 6 ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
}

async function assertAllowedTarget(url: URL): Promise<void> {
  if (url.protocol !== 'https:') throw new OutboundError('scheme not allowed');
  if (url.username || url.password) throw new OutboundError('credentials in URL not allowed');
  if (url.port && url.port !== '443') throw new OutboundError('port not allowed');
  const host = url.hostname.toLowerCase();
  if (isIP(host)) throw new OutboundError('IP literal hosts not allowed');
  if (!featureConfig().outboundAllowedHosts.has(host)) throw new OutboundError('host not allowed');
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new OutboundError('host resolves to a non-public address');
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new OutboundError('response too large');
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new OutboundError('response too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export interface SafeResponse {
  status: number;
  headers: Headers;
  body: Uint8Array;
  json<T = unknown>(): T;
}

/**
 * Fetch an allow-listed https URL. Never pass user-supplied URLs: callers build the URL from
 * server configuration plus validated identifiers only.
 */
export async function safeOutboundFetch(
  target: URL,
  init: RequestInit & { timeoutMs?: number; maxResponseBytes?: number } = {},
): Promise<SafeResponse> {
  await assertAllowedTarget(target);
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES, ...rest } = init;
  const res = await fetch(target, { ...rest, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
  if (res.status >= 300 && res.status < 400) throw new OutboundError('redirects not allowed');
  const body = await readCapped(res, maxResponseBytes);
  return {
    status: res.status,
    headers: res.headers,
    body,
    json<T>() {
      return JSON.parse(new TextDecoder().decode(body)) as T;
    },
  };
}
