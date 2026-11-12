/**
 * Native secure storage (iOS Keychain / Android Keystore) for the Supabase session and other secrets.
 * - T270/T2133/T295: tokens never go to AsyncStorage or plain files.
 * - T5634: WHEN_UNLOCKED_THIS_DEVICE_ONLY → items never sync through iCloud Keychain or device backups.
 * SecureStore values are limited (~2 KB), so large values (the Supabase session JSON) are chunked.
 */
import * as SecureStore from 'expo-secure-store';

export const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const CHUNK = 1800;
const PREFIX = 'acme.'; // SecureStore keys: [A-Za-z0-9._-]
const INDEX_KEY = `${PREFIX}keys`; // registry of every key we wrote, so logout can wipe them all

const safeKey = (key: string) => PREFIX + key.replace(/[^A-Za-z0-9._-]/g, '_');

async function readIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY, SECURE_OPTIONS);
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

async function addToIndex(key: string) {
  const keys = await readIndex();
  if (!keys.includes(key)) {
    keys.push(key);
    await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(keys), SECURE_OPTIONS);
  }
}

async function removeChunks(k: string) {
  const count = Number((await SecureStore.getItemAsync(`${k}.n`, SECURE_OPTIONS)) ?? '0');
  for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${k}.${i}`, SECURE_OPTIONS);
  await SecureStore.deleteItemAsync(`${k}.n`, SECURE_OPTIONS);
}

export const nativeSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safeKey(key);
    const n = await SecureStore.getItemAsync(`${k}.n`, SECURE_OPTIONS);
    if (!n) return null;
    const parts: string[] = [];
    for (let i = 0; i < Number(n); i++) {
      const part = await SecureStore.getItemAsync(`${k}.${i}`, SECURE_OPTIONS);
      if (part === null) return null; // corrupted → treat as signed out
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    const k = safeKey(key);
    await removeChunks(k);
    const count = Math.ceil(value.length / CHUNK) || 1;
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), SECURE_OPTIONS);
    }
    await SecureStore.setItemAsync(`${k}.n`, String(count), SECURE_OPTIONS);
    await addToIndex(k);
  },
  async removeItem(key: string): Promise<void> {
    await removeChunks(safeKey(key));
  },
};

/** Small single-value secrets (active org id, biometric preference). */
export async function setSecret(key: string, value: string) {
  await nativeSecureStorage.setItem(key, value);
}
export async function getSecret(key: string) {
  return nativeSecureStorage.getItem(key);
}

/** Wipes every item this app wrote to SecureStore (logout, account deletion — T164/T5660). */
export async function wipeSecureStorage(): Promise<void> {
  for (const k of await readIndex()) await removeChunks(k);
  await SecureStore.deleteItemAsync(INDEX_KEY, SECURE_OPTIONS);
}
