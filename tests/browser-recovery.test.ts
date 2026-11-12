import { describe, expect, it } from "vitest";
import {
  validateRecoveryRecord,
  recoveryBytes,
  BrowserRecovery,
} from "../src/workspace/browserRecovery";

describe("browser recovery records", () => {
  it("retains multiple raw documents including invalid JSON without interpretation", () => {
    const record = {
      id: "window-a",
      documents: [
        { name: "a.json", text: '{"unfinished":' },
        { name: "b.json", text: "  [1]\r\n" },
      ],
    };
    expect(validateRecoveryRecord(record)).toEqual(record);
    expect(recoveryBytes(record.documents)).toBe(
      2 * ("a.json".length + 14 + "b.json".length + 7),
    );
  });
  it("rejects unexpected fields and malformed documents rather than restoring partial data", () => {
    for (const record of [
      null,
      { id: "", documents: [] },
      { id: "a", documents: [{ name: "a", text: 3 }] },
      { id: "a", documents: [{ name: "a", text: "x", handle: {} }] },
      { id: "a", documents: [], token: "secret" },
    ]) {
      expect(() => validateRecoveryRecord(record)).toThrow(/recovery/i);
    }
  });
  it("rejects unavailable storage explicitly and never reports a successful write", async () => {
    const recovery = new BrowserRecovery("test-window");
    await expect(recovery.write([{ name: "a", text: "{}" }])).rejects.toThrow(
      /storage|IndexedDB/i,
    );
    recovery.close();
  });
});

// Minimal asynchronous IDB surface: complete follows request success, and abort
// preserves the previous transaction contents. Browser integration remains separate.
import { afterEach, vi } from "vitest";
afterEach(() => vi.unstubAllGlobals());
function fakeStorage(initial: unknown[]) {
  let rows = structuredClone(initial) as { id: string }[];
  const database = {
    close() {},
    transaction() {
      let next = structuredClone(rows);
      let aborted = false;
      const transaction = {
        oncomplete: null as null | (() => void),
        onabort: null as null | (() => void),
        onerror: null,
        abort() {
          aborted = true;
          queueMicrotask(() => transaction.onabort?.());
        },
        objectStore() {
          return {
            getAll() {
              const request = {
                result: structuredClone(next),
                onsuccess: null as null | (() => void),
              };
              queueMicrotask(() => {
                request.onsuccess?.();
                if (!aborted) {
                  rows = next;
                  transaction.oncomplete?.();
                }
              });
              return request;
            },
            put(record: { id: string }) {
              next = [
                ...next.filter((row) => row.id !== record.id),
                structuredClone(record),
              ];
            },
            delete(id: string) {
              next = next.filter((row) => row.id !== id);
              queueMicrotask(() => {
                if (!aborted) {
                  rows = next;
                  transaction.oncomplete?.();
                }
              });
            },
            clear() {
              next = [];
              queueMicrotask(() => {
                rows = next;
                transaction.oncomplete?.();
              });
            },
          };
        },
      };
      return transaction;
    },
  };
  vi.stubGlobal("indexedDB", {
    open() {
      const request = {
        result: database,
        onsuccess: null as null | (() => void),
      };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  });
  return () => rows;
}
function mockLocks(initial: string[] = []) {
  const held = new Set(initial);
  vi.stubGlobal("navigator", {
    locks: {
      async request(name: string, callback: () => Promise<void>) {
        held.add(name);
        try {
          await callback();
        } finally {
          held.delete(name);
        }
      },
      async query() {
        return { held: [...held].map((name) => ({ name })) };
      },
    },
  });
  return held;
}
it("excludes live windows via owner leases, returns crashed drafts, and deletes only its own empty snapshot", async () => {
  mockLocks();
  const rows = fakeStorage([
    { id: "active", documents: [{ name: "live", text: "{" }] },
    { id: "crashed", documents: [{ name: "draft", text: "[" }] },
  ]);
  const active = new BrowserRecovery("active");
  const current = new BrowserRecovery("current");
  try {
    await current.write([{ name: "own", text: "broken" }]);
    expect(
      (await current.listRecoverable()).map((record) => record.id),
    ).toEqual(["crashed"]);
    await current.write([]);
    expect(rows().map((record) => record.id)).toEqual(["active", "crashed"]);
  } finally {
    active.close();
    current.close();
  }
});
it("rejects corrupt records without deleting them", async () => {
  mockLocks();
  const rows = fakeStorage([
    { id: "corrupt", documents: [{ name: "x", text: 9 }] },
  ]);
  const current = new BrowserRecovery("current");
  try {
    await expect(current.listRecoverable()).rejects.toThrow(
      /Invalid recovery document/,
    );
    expect(rows()).toHaveLength(1);
  } finally {
    current.close();
  }
});
it("excludes a suspended live window using held Web Locks even without BroadcastChannel", async () => {
  vi.stubGlobal("BroadcastChannel", undefined);
  const held = new Set(["lattice-recovery-owner:suspended"]);
  vi.stubGlobal("navigator", {
    locks: {
      async request(name: string, callback: () => Promise<void>) {
        held.add(name);
        try {
          await callback();
        } finally {
          held.delete(name);
        }
      },
      async query() {
        return { held: [...held].map((name) => ({ name })) };
      },
    },
  });
  fakeStorage([
    { id: "suspended", documents: [{ name: "active", text: "draft" }] },
    { id: "crashed", documents: [{ name: "old", text: "{" }] },
  ]);
  const current = new BrowserRecovery("current");
  try {
    expect(
      (await current.listRecoverable()).map((record) => record.id),
    ).toEqual(["crashed"]);
  } finally {
    current.close();
  }
  await vi.waitFor(() =>
    expect(held.has("lattice-recovery-owner:current")).toBe(false),
  );
});
it("fails safely without Web Locks and leaves existing drafts intact", async () => {
  vi.stubGlobal("navigator", {});
  const rows = fakeStorage([
    { id: "old", documents: [{ name: "draft", text: "{" }] },
  ]);
  const current = new BrowserRecovery("current");
  try {
    await expect(current.listRecoverable()).rejects.toThrow(
      "Safe recovery requires browser Web Locks support",
    );
    expect(rows()).toHaveLength(1);
  } finally {
    current.close();
  }
});
