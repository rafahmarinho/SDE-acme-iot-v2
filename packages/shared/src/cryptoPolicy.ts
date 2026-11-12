/**
 * Cryptographic policy — single source of truth (T59, T60).
 *
 * Approved: SHA-256, HMAC-SHA256, Ed25519 (or ECDSA P-256), AES-256-GCM with a random 96-bit IV.
 * Forbidden: MD5, SHA-1, DES/3DES, RC4, any ECB mode, RSA < 2048, home-made ciphers or "encoding as
 * encryption". Passwords are never hashed in this codebase — Supabase Auth (bcrypt) owns them.
 *
 * Implementations: `node:crypto` on the server, WebCrypto / `expo-crypto` on clients.
 */
export const CRYPTO_POLICY = {
  hash: 'sha256',
  hmac: 'sha256',
  signature: 'ed25519',
  symmetric: 'aes-256-gcm',
  ivBytes: 12,
  tagBytes: 16,
  /** Minimum length of any system/shared secret (T69). */
  minSecretBytes: 32,
  /** Maximum clock skew accepted for signed system requests. */
  maxSkewSeconds: 300,
} as const;

export const FORBIDDEN_ALGORITHMS = ['md5', 'sha1', 'des', 'des3', 'rc4', 'ecb'] as const;
