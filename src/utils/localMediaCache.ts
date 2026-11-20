import { MediaAsset } from '../types/portal';

const DB_NAME = 'fmot_portal_cache_v1';
const DB_VERSION = 1;
const STORE_MEDIA = 'media_assets';
const STORE_SNAPSHOTS = 'snapshots';

interface SnapshotRecord {
  key: string;
  data: unknown;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

export function closeCacheConnection(): void {
  const current = dbPromise;
  dbPromise = null;
  if (current) {
    void current.then((db) => {
      try {
        db?.close();
      } catch {
        // ignore close errors
      }
    });
  }
}

function openCacheDb(): Promise<IDBDatabase | null> {
  if (typeof globalThis === 'undefined' || !('indexedDB' in globalThis) || !globalThis.indexedDB) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };
      request.onblocked = () => {
        dbPromise = null;
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

function stripNonCloneableAssetFields(asset: MediaAsset): MediaAsset {
  return {
    id: asset.id,
    fileName: asset.fileName || '',
    mimeType: asset.mimeType || 'image/webp',
    dataUrl: asset.publicUrl || asset.dataUrl || '',
    storagePath: asset.storagePath,
    publicUrl: asset.publicUrl,
    source: asset.source,
    width: Number(asset.width) || 0,
    height: Number(asset.height) || 0,
    sizeBytes: Number(asset.sizeBytes) || 0,
    page: asset.page,
    title: asset.title || '',
    description: asset.description || '',
    uploadedBy: asset.uploadedBy || '',
  };
}

export async function getCachedMediaAssets(): Promise<MediaAsset[]> {
  const db = await openCacheDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MEDIA, 'readonly');
      const store = tx.objectStore(STORE_MEDIA);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as MediaAsset[]) : []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function getCachedMediaAsset(id: string): Promise<MediaAsset | null> {
  const db = await openCacheDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MEDIA, 'readonly');
      const store = tx.objectStore(STORE_MEDIA);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as MediaAsset | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putCachedMediaAsset(asset: MediaAsset): Promise<void> {
  if (!asset?.id || !asset?.dataUrl) return;
  const db = await openCacheDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MEDIA, 'readwrite');
      tx.objectStore(STORE_MEDIA).put(stripNonCloneableAssetFields(asset));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function putCachedMediaAssets(assets: MediaAsset[]): Promise<void> {
  if (!assets.length) return;
  const db = await openCacheDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MEDIA, 'readwrite');
      const store = tx.objectStore(STORE_MEDIA);
      assets.forEach((asset) => {
        if (asset?.id && asset?.dataUrl) {
          store.put(stripNonCloneableAssetFields(asset));
        }
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function deleteCachedMediaAsset(id: string): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MEDIA, 'readwrite');
      tx.objectStore(STORE_MEDIA).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getCachedSnapshot<T>(key: string): Promise<T | null> {
  const db = await openCacheDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
      const req = tx.objectStore(STORE_SNAPSHOTS).get(key);
      req.onsuccess = () => {
        const record = req.result as SnapshotRecord | undefined;
        resolve(record ? (record.data as T) : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putCachedSnapshot(key: string, data: unknown): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const serializable = JSON.parse(JSON.stringify(data));
      const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
      const record: SnapshotRecord = {
        key,
        data: serializable,
        updatedAt: Date.now(),
      };
      tx.objectStore(STORE_SNAPSHOTS).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function deleteCachedSnapshot(key: string): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
      tx.objectStore(STORE_SNAPSHOTS).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
