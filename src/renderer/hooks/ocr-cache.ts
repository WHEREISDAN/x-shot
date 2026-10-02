// tesseract.js caches decompressed language data in this IndexedDB store.
// Older versions used the default cache path, so their data sits under
// LEGACY_CACHE_KEY; the current data lives under OCR_CACHE_PATH instead.
const CACHE_DATABASE = 'keyval-store';
const CACHE_STORE = 'keyval';
const LEGACY_CACHE_KEY = './eng.traineddata';

/** Deletes language data cached by older versions (about 23 MB). */
export default async function removeLegacyOcrCache(): Promise<void> {
  if (typeof indexedDB === 'undefined' || !indexedDB.databases) return;
  const databases = await indexedDB.databases();
  // Opening a database that does not exist would create it.
  if (!databases.some((db) => db.name === CACHE_DATABASE)) return;

  await new Promise<void>((resolve) => {
    const request = indexedDB.open(CACHE_DATABASE);
    request.onerror = () => resolve();
    request.onsuccess = () => {
      const db = request.result;
      const finish = () => {
        db.close();
        resolve();
      };
      try {
        const transaction = db.transaction(CACHE_STORE, 'readwrite');
        transaction.objectStore(CACHE_STORE).delete(LEGACY_CACHE_KEY);
        transaction.oncomplete = finish;
        transaction.onerror = finish;
      } catch {
        finish();
      }
    };
  });
}
