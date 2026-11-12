export interface RecoveryDocument {
  name: string;
  text: string;
}
export interface RecoveryRecord {
  id: string;
  documents: RecoveryDocument[];
}
const DOCUMENT_LIMIT = 64 * 1024 * 1024;
const TOTAL_LIMIT = 128 * 1024 * 1024;
const STORE = "windows";

function exactKeys(value: object, keys: string[]) {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
export function recoveryBytes(documents: RecoveryDocument[]): number {
  return documents.reduce(
    (sum, document) => sum + 2 * (document.name.length + document.text.length),
    0,
  );
}
export function validateRecoveryRecord(value: unknown): RecoveryRecord {
  if (
    !value ||
    typeof value !== "object" ||
    !exactKeys(value, ["id", "documents"])
  )
    throw new Error("Invalid recovery record.");
  const record = value as RecoveryRecord;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    record.id.length > 200 ||
    !Array.isArray(record.documents) ||
    record.documents.length > 1000
  )
    throw new Error("Invalid recovery record.");
  for (const document of record.documents) {
    if (
      !document ||
      typeof document !== "object" ||
      !exactKeys(document, ["name", "text"]) ||
      typeof document.name !== "string" ||
      typeof document.text !== "string"
    )
      throw new Error("Invalid recovery document.");
    if (2 * (document.name.length + document.text.length) > DOCUMENT_LIMIT)
      throw new Error(
        "Recovery document exceeds the 64 MiB memory limit. Save it to disk instead.",
      );
  }
  if (recoveryBytes(record.documents) > TOTAL_LIMIT)
    throw new Error(
      "Recovery exceeds the 128 MiB memory limit. Save documents to disk instead.",
    );
  return record;
}
function storageError(error: unknown): Error {
  return new Error(
    `Browser recovery storage failed: ${error instanceof Error ? error.message : String(error)}. Save your documents to disk.`,
  );
}

/** Raw local drafts only. Creation does not open IndexedDB. */
export class BrowserRecovery {
  private database?: Promise<IDBDatabase>;
  private pending = Promise.resolve();
  private closed = false;
  private releaseLease?: () => void;
  private leaseReady?: Promise<void>;
  private leaseError?: unknown;
  private locks: LockManager | undefined;
  constructor(private readonly owner = crypto.randomUUID()) {
    this.locks = typeof navigator === "undefined" ? undefined : navigator.locks;
    if (this.locks) {
      this.leaseReady = new Promise<void>((ready) => {
        void this.locks!.request(
          `lattice-recovery-owner:${this.owner}`,
          async () => {
            ready();
            if (!this.closed)
              await new Promise<void>((release) => {
                this.releaseLease = release;
              });
          },
        ).catch((error) => {
          this.leaseError = error;
          ready();
        });
      });
    }
  }

  private open(): Promise<IDBDatabase> {
    if (this.closed)
      return Promise.reject(new Error("Browser recovery storage is closed."));
    if (typeof indexedDB === "undefined")
      return Promise.reject(
        new Error(
          "IndexedDB recovery storage is unavailable. Save your documents to disk.",
        ),
      );
    if (!this.database)
      this.database = new Promise((resolve, reject) => {
        let blocked = false;
        const request = indexedDB.open("lattice-browser-recovery", 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore(STORE, { keyPath: "id" });
        request.onerror = () => reject(storageError(request.error));
        request.onblocked = () => {
          blocked = true;
          reject(
            new Error(
              "Browser recovery storage is blocked by another app window. Close older Lattice windows and retry.",
            ),
          );
        };
        request.onsuccess = () => {
          if (this.closed || blocked) {
            request.result.close();
            reject(new Error("Browser recovery storage is closed."));
          } else {
            request.result.onversionchange = () => request.result.close();
            resolve(request.result);
          }
        };
      });
    return this.database;
  }
  private async transaction<T>(
    mode: IDBTransactionMode,
    action: (
      store: IDBObjectStore,
      result: (value: T) => void,
      fail: (error: unknown) => void,
    ) => void,
  ): Promise<T> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      let result: T;
      let failure: unknown;
      const transaction = database.transaction(STORE, mode);
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () =>
        reject(storageError(failure ?? transaction.error));
      transaction.onerror = () => {
        failure ??= transaction.error;
      };
      try {
        action(
          transaction.objectStore(STORE),
          (value) => {
            result = value;
          },
          (error) => {
            failure = error;
            transaction.abort();
          },
        );
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    });
  }
  write(documents: RecoveryDocument[]): Promise<void> {
    // Snapshot now so later edits cannot alter a queued write.
    let record: RecoveryRecord;
    try {
      record = structuredClone(
        validateRecoveryRecord({ id: this.owner, documents }),
      );
    } catch (error) {
      return Promise.reject(storageError(error));
    }
    if (!record.documents.length) return this.remove([this.owner]);
    const operation = this.pending.then(() =>
      this.transaction<void>("readwrite", (store, done, fail) => {
        const request = store.getAll();
        request.onsuccess = () => {
          try {
            const others = request.result
              .map(validateRecoveryRecord)
              .filter((item) => item.id !== this.owner);
            if (
              others.reduce(
                (sum, item) => sum + recoveryBytes(item.documents),
                recoveryBytes(record.documents),
              ) > TOTAL_LIMIT
            )
              throw new Error(
                "All recovery windows exceed the 128 MiB memory limit. Save documents to disk and remove older recoveries.",
              );
            store.put(record);
            done(undefined);
          } catch (error) {
            // Abort keeps the previous complete snapshot intact.
            fail(error);
          }
        };
      }),
    );
    this.pending = operation.catch(() => {});
    return operation;
  }
  private async liveOwners(): Promise<Set<string>> {
    if (this.locks) {
      await this.leaseReady;
      if (this.leaseError) throw storageError(this.leaseError);
      const snapshot = await this.locks.query();
      const prefix = "lattice-recovery-owner:";
      return new Set([
        this.owner,
        ...(snapshot.held ?? []).flatMap((lock) =>
          lock.name?.startsWith(prefix) ? [lock.name.slice(prefix.length)] : [],
        ),
      ]);
    }
    throw new Error(
      "Safe recovery requires browser Web Locks support. Use current Chrome or Edge.",
    );
  }

  async listRecoverable(): Promise<RecoveryRecord[]> {
    const active = await this.liveOwners();
    return this.transaction<RecoveryRecord[]>(
      "readonly",
      (store, done, fail) => {
        const request = store.getAll();
        request.onsuccess = () => {
          try {
            done(
              request.result
                .map(validateRecoveryRecord)
                .filter((record) => !active.has(record.id)),
            );
          } catch (error) {
            fail(error);
          }
        };
      },
    );
  }
  remove(ids: string[]): Promise<void> {
    const selected = [...ids];
    const operation = this.pending.then(() =>
      this.transaction<void>("readwrite", (store, done) => {
        for (const id of selected) store.delete(id);
        done(undefined);
      }),
    );
    this.pending = operation.catch(() => {});
    return operation;
  }
  clearAll(): Promise<void> {
    const operation = this.pending.then(() =>
      this.transaction<void>("readwrite", (store, done) => {
        store.clear();
        done(undefined);
      }),
    );
    this.pending = operation.catch(() => {});
    return operation;
  }
  close(): void {
    this.closed = true;
    this.releaseLease?.();
    void this.database?.then(
      (database) => database.close(),
      () => {},
    );
  }
}
