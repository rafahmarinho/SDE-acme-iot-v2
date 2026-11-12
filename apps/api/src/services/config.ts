/**
 * Feature-level configuration for device simulation, firmware signing, outbound calls and mail.
 * Built on the validated server env (apps/api/src/lib/env.ts) so misconfiguration fails closed
 * (T156, T248, T1365, T558).
 */
import { createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto';
import { env } from '../lib/env';

// T156: certificate validation must never be disabled for any outbound call. A private simulator CA,
// if ever needed, is trusted explicitly with NODE_EXTRA_CA_CERTS — validation stays on.
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  throw new Error('TLS certificate validation must not be disabled (NODE_TLS_REJECT_UNAUTHORIZED=0)');
}

function optionalHttpsUrl(name: string): URL | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error(`${name} must use https`);
  return url;
}

export interface FeatureConfig {
  deviceSimBaseUrl: URL;
  deviceSimSharedSecret: Buffer;
  firmwarePrivateKey: KeyObject;
  firmwarePublicKey: KeyObject;
  firmwareKeyId: string;
  outboundAllowedHosts: ReadonlySet<string>;
  mail: { providerUrl?: URL; providerToken?: string; from: string };
}

let cached: FeatureConfig | undefined;

export function featureConfig(): FeatureConfig {
  if (cached) return cached;

  const firmwarePrivateKey = createPrivateKey(env.FIRMWARE_SIGNING_PRIVATE_KEY);
  const firmwarePublicKey = createPublicKey(env.FIRMWARE_SIGNING_PUBLIC_KEY);
  if (firmwarePrivateKey.asymmetricKeyType !== 'ed25519' || firmwarePublicKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('Firmware signing keys must be Ed25519');
  }

  const deviceSimBaseUrl = new URL(env.DEVICE_SIM_BASE_URL);
  const providerUrl = optionalHttpsUrl('MAIL_PROVIDER_URL');

  // Outbound allow-list: fixed server-side hosts only (simulator, Supabase Storage for firmware
  // downloads, mail provider) plus integration catalog hosts listed in OUTBOUND_ALLOWED_HOSTS.
  const hosts = new Set(
    (process.env.OUTBOUND_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
  hosts.add(deviceSimBaseUrl.hostname.toLowerCase());
  hosts.add(new URL(env.SUPABASE_URL).hostname.toLowerCase());
  if (providerUrl) hosts.add(providerUrl.hostname.toLowerCase());

  cached = {
    deviceSimBaseUrl,
    deviceSimSharedSecret: Buffer.from(env.DEVICE_SIM_SHARED_SECRET, 'utf8'),
    firmwarePrivateKey,
    firmwarePublicKey,
    firmwareKeyId: env.FIRMWARE_SIGNING_KEY_ID,
    outboundAllowedHosts: hosts,
    mail: {
      providerUrl,
      providerToken: process.env.MAIL_PROVIDER_TOKEN?.trim() || undefined,
      from: process.env.MAIL_FROM?.trim() || 'ACME IoT <no-reply@acme-iot.example>',
    },
  };
  return cached;
}
