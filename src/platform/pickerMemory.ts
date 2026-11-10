// Store only a browser-issued handle, never an inferred absolute path.
// Storage is optional: file:// origins and managed browsers may reject it.
function database(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open("lattice-picker-memory", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("handles");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
export async function readPickerHandle(): Promise<unknown | null> {
  const db = await database();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("handles", "readonly");
      const request = tx.objectStore("handles").get("open-json");
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onabort = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}
export async function rememberPickerHandle(handle: unknown): Promise<void> {
  const db = await database();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").put(handle, "open-json");
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}
