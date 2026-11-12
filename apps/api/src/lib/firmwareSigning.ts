/**
 * Firmware release signing and verification (T2486 server side, T197 device side, T585 content gate).
 *
 * The device manifest is the ONLY data delivered to devices; it is canonical JSON with a fixed field
 * set and is signed with the server-held Ed25519 key. The private key exists only in Vercel env.
 */
import { createHash, sign, verify, type KeyObject } from 'node:crypto';
import { featureConfig } from '../services/config';

export const MAX_FIRMWARE_BYTES = 2 * 1024 * 1024;

export const DEVICE_MODELS = [
  'thermostat',
  'smart_plug',
  'temperature_sensor',
  'humidity_sensor',
  'occupancy_sensor',
] as const;
export type DeviceModel = (typeof DEVICE_MODELS)[number];

/** T585: the device-facing manifest exposes only these fields — never notes, URLs or uploader data. */
export interface ManifestBody {
  version: string;
  model: DeviceModel;
  size: number;
  sha256: string;
  releasedAt: string;
  keyId: string;
}

export interface SignedManifest {
  body: ManifestBody;
  signature: string; // base64 Ed25519 over canonical(body)
}

const SEMVER_RE = /^(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/;

export function parseSemver(v: string): [number, number, number] {
  const m = SEMVER_RE.exec(v);
  if (!m) throw new Error('version must be MAJOR.MINOR.PATCH');
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parseSemver(candidate);
  const b = parseSemver(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

/** Deterministic serialization: fixed key order, so signer and verifier hash identical bytes. */
export function canonicalManifest(body: ManifestBody): Buffer {
  const ordered: ManifestBody = {
    version: body.version,
    model: body.model,
    size: body.size,
    sha256: body.sha256,
    releasedAt: body.releasedAt,
    keyId: body.keyId,
  };
  return Buffer.from(JSON.stringify(ordered), 'utf8');
}

/** T585: block artifacts that embed credentials, keys, tokens, internal endpoints or PII. */
const FORBIDDEN_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['JWT / Supabase key', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./],
  ['service role reference', /SERVICE_ROLE/i],
  ['shared device secret reference', /DEVICE_SIM_SHARED_SECRET/i],
  ['password assignment', /pass(word|wd)?\s*[:=]\s*\S+/i],
  ['api key assignment', /api[_-]?key\s*[:=]\s*\S+/i],
  ['email address', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/],
  ['internal URL', /https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|[a-z0-9-]+\.supabase\.co)/i],
  ['debug marker', /\b(DEBUG_BUILD|__debug_symbols__|\.debug_info)\b/],
];

export function assertNoSensitiveContent(blob: Buffer): void {
  const text = blob.toString('latin1');
  for (const [label, re] of FORBIDDEN_PATTERNS) {
    if (re.test(text)) throw new Error(`Release blocked: artifact contains ${label}`);
  }
}

export function sha256Hex(blob: Buffer): string {
  return createHash('sha256').update(blob).digest('hex');
}

/** Server side (T2486): gate, hash and sign. Encrypt-then-sign is supported by passing ciphertext. */
export function buildSignedRelease(blob: Buffer, model: DeviceModel, version: string): SignedManifest {
  if (blob.length === 0 || blob.length > MAX_FIRMWARE_BYTES) throw new Error('firmware size out of range');
  parseSemver(version);
  assertNoSensitiveContent(blob);
  const cfg = featureConfig();
  const body: ManifestBody = {
    version,
    model,
    size: blob.length,
    sha256: sha256Hex(blob),
    releasedAt: new Date().toISOString(),
    keyId: cfg.firmwareKeyId,
  };
  const signature = sign(null, canonicalManifest(body), cfg.firmwarePrivateKey).toString('base64');
  return { body, signature };
}

/** Device side (T197): verify with a PINNED public key — never one delivered alongside the update. */
export function verifySignedManifest(manifest: SignedManifest, trustedKey: KeyObject): boolean {
  try {
    return verify(null, canonicalManifest(manifest.body), trustedKey, Buffer.from(manifest.signature, 'base64'));
  } catch {
    return false;
  }
}
