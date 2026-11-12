/**
 * Web-only encrypted storage (T1468).
 * A non-extractable AES-GCM-256 key is generated with WebCrypto and kept in IndexedDB; only ciphertext
 * is persisted. Nothing is written to localStorage/sessionStorage. Everything (key + data) is deleted
 * on logout (T1539). Note: XSS defeats any browser-side encryption, so CSP/XSS controls (T36/T37/T66)
 * remain the primary defence; this protects data at rest on shared machines and in disk forensics.
 */
const DB_NAME = 'acme-vault';
const STORE = 'kv';
const KEY_ID = '__key';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function getKey(): Promise<CryptoKey> {
  const existing = await idb<CryptoKey | undefined>('readonly', (s) => s.get(KEY_ID));
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await idb('readwrite', (s) => s.put(key, KEY_ID));
  return key;
}

type Sealed = { iv: number[]; ct: ArrayBuffer };

export const webVault = {
  async getItem(name: string): Promise<string | null> {
    const sealed = await idb<Sealed | undefined>('readonly', (s) => s.get(name));
    if (!sealed) return null;
    try {
      const pt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(sealed.iv) },
        await getKey(),
        sealed.ct,
      );
      return new TextDecoder().decode(pt);
    } catch {
      await idb('readwrite', (s) => s.delete(name)); // tampered or key rotated → drop it
      return null;
    }
  },
  async setItem(name: string, value: string): Promise<void> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getKey(), new TextEncoder().encode(value));
    const sealed: Sealed = { iv: Array.from(iv), ct };
    await idb('readwrite', (s) => s.put(sealed, name));
  },
  async removeItem(name: string): Promise<void> {
    await idb('readwrite', (s) => s.delete(name));
  },
};

/** Deletes the vault database (key + ciphertext) and any other browser storage the app may have touched. */
export async function wipeBrowserStorage(): Promise<void> {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* storage may be unavailable (private mode) */
  }
  const dbs = (await indexedDB.databases?.()) ?? [{ name: DB_NAME }];
  await Promise.all(
    dbs
      .map((d) => d.name)
      .filter((n): n is string => !!n)
      .map(
        (n) =>
          new Promise<void>((resolve) => {
            const req = indexedDB.deleteDatabase(n);
            req.onsuccess = req.onerror = req.onblocked = () => resolve();
          }),
      ),
  );
  if ('caches' in globalThis) {
    for (const k of await caches.keys()) await caches.delete(k);
  }
}
