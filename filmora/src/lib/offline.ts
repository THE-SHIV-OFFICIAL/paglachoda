"use client";

/**
 * Offline video vault — stores the actual downloaded file in IndexedDB so the
 * user can play it inside the app with no internet connection.
 */

const DB_NAME = "moviebox-offline";
const STORE = "videos";
const DB_VERSION = 1;

export const OFFLINE_EVENT = "offlineVaultUpdated";

function emit() {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(OFFLINE_EVENT));
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            reject(new Error("Offline storage is not available in this browser."));
            return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Could not open offline storage."));
    });
}

async function withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    const db = await openDb();
    return new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error ?? new Error("Offline storage error."));
        tx.oncomplete = () => db.close();
    });
}

export interface OfflineRecord {
    id: string;
    blob: Blob;
    type: string;
    size: number;
    fileName: string;
    savedAt: number;
}

export async function saveOffline(
    id: string,
    blob: Blob,
    fileName: string,
): Promise<boolean> {
    try {
        const record: OfflineRecord = {
            id,
            blob,
            type: blob.type || "video/mp4",
            size: blob.size,
            fileName,
            savedAt: Date.now(),
        };
        await withStore("readwrite", (s) => s.put(record, id) as IDBRequest<IDBValidKey>);
        emit();
        return true;
    } catch {
        return false;
    }
}

export async function getOffline(id: string): Promise<OfflineRecord | null> {
    try {
        const rec = await withStore<OfflineRecord | undefined>("readonly", (s) => s.get(id));
        return rec ?? null;
    } catch {
        return null;
    }
}

export async function deleteOffline(id: string): Promise<void> {
    try {
        await withStore("readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>);
        emit();
    } catch {
        /* ignore */
    }
}

export async function listOfflineIds(): Promise<string[]> {
    try {
        const keys = await withStore<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
        return keys.map(String);
    } catch {
        return [];
    }
}

/** How much space is used / still available for offline videos. */
export async function offlineUsage(): Promise<{ usage: number; quota: number } | null> {
    try {
        if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
        const est = await navigator.storage.estimate();
        return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
    } catch {
        return null;
    }
}

/** Ask the browser to keep offline videos even when storage gets tight. */
export async function requestPersistentStorage(): Promise<boolean> {
    try {
        if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
        if (await navigator.storage.persisted?.()) return true;
        return await navigator.storage.persist();
    } catch {
        return false;
    }
}
