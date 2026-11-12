/**
 * Cryptographic primitives for the API — `node:crypto` only (T59, T60, T151, T69).
 *
 * - Randomness: `randomBytes` / `randomInt` / `randomUUID` (CSPRNG). `Math.random` is banned in
 *   security code by apps/api/eslint.config.js; simulation noise must use its own seeded PRNG.
 * - Hashing: SHA-256. MAC: HMAC-SHA256 with constant-time comparison.
 * - Signatures: Ed25519 helpers live in firmwareSigning.ts (Layer C) and use the same policy.
 */
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { CRYPTO_POLICY } from '@acme-iot/shared';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 symbols, no I/O/0/1

/** Manual device registration code `XXXX-XXXX-XXXX` (60 bits). Store only `sha256Hex(code)`. */
export function newRegistrationCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < 3; g++) {
    let s = '';
    for (let i = 0; i < 4; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    groups.push(s);
  }
  return groups.join('-');
}

/** Opaque single-use token for QR payloads / invites (256 bits). Store only its hash. */
export function newToken(bytes = 32): string {
  if (bytes < CRYPTO_POLICY.minSecretBytes) throw new Error('token too short');
  return randomBytes(bytes).toString('base64url');
}

/** Per-device / per-integration system credential (T69). The secret is shown once; persist `hash`. */
export function newSystemCredential(): { secret: string; hash: string } {
  const secret = randomBytes(32).toString('base64url');
  return { secret, hash: sha256Hex(secret) };
}

export function newRequestId(): string {
  return randomUUID();
}

export function sha256Hex(data: string | Buffer): string {
  return createHash(CRYPTO_POLICY.hash).update(data).digest('hex');
}

export function hmacSha256Hex(secret: string, data: string | Buffer): string {
  if (Buffer.byteLength(secret, 'utf8') < CRYPTO_POLICY.minSecretBytes) throw new Error('weak secret');
  return createHmac(CRYPTO_POLICY.hmac, secret).update(data).digest('hex');
}

/** Constant-time comparison of two hex/base64 strings. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
