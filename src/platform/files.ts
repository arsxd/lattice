import { readPickerHandle, rememberPickerHandle } from "./pickerMemory";
import { invoke, isTauri } from "@tauri-apps/api/core";
export const desktop = isTauri();
type BrowserHandle = {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{
    write(data: string): Promise<void>;
    close(): Promise<void>;
    abort(): Promise<void>;
  }>;
};
type Pickers = {
  showOpenFilePicker?: (options: unknown) => Promise<BrowserHandle[]>;
  showSaveFilePicker?: (options: unknown) => Promise<BrowserHandle>;
};
const pickers = globalThis as unknown as Pickers;
let lastOpenHandle: BrowserHandle | undefined;
if (!desktop)
  void readPickerHandle().then((handle) => {
    if (
      !lastOpenHandle &&
      handle &&
      typeof (handle as BrowserHandle).getFile === "function"
    )
      lastOpenHandle = handle as BrowserHandle;
  });
export const browserSave =
  !desktop && typeof pickers.showSaveFilePicker === "function";
export type Opened = {
  name: string;
  text: string;
  token?: string;
  handle?: BrowserHandle;
  diskText?: string;
};
export async function readJsonFile(file: File): Promise<string> {
  if (file.size > 64 * 1024 * 1024)
    throw new Error(
      `"${file.name}" is too large. Lattice opens files up to 64 MiB.`,
    );
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    throw new Error(
      `"${file.name}" could not be read as UTF-8 text. Export it as UTF-8 JSON and try again.`,
    );
  }
}
async function readBrowserFile(handle: BrowserHandle) {
  return readJsonFile(await handle.getFile());
}
export async function droppedJsonFile(
  file: File,
  handle?: BrowserHandle,
): Promise<Opened> {
  const text = await readJsonFile(file);
  return {
    name: file.name,
    text,
    ...(handle ? { handle, diskText: text } : {}),
  };
}
export async function prepareBrowserSave(
  doc: Opened,
  as: boolean,
): Promise<Opened | null> {
  if (!browserSave || (!as && doc.handle)) return doc;
  try {
    const handle = await pickers.showSaveFilePicker!({
      id: "lattice-save-json",
      suggestedName: doc.name,
      types: [
        { description: "JSON", accept: { "application/json": [".json"] } },
      ],
    });
    return {
      ...doc,
      name: handle.name,
      handle,
      diskText: await readBrowserFile(handle),
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null;
    throw e;
  }
}
export async function openFile(): Promise<Opened | null> {
  if (desktop) return invoke("open_document");
  if (pickers.showOpenFilePicker) {
    try {
      const [handle] = await pickers.showOpenFilePicker({
        id: "lattice-open-json",
        ...(lastOpenHandle ? { startIn: lastOpenHandle } : {}),
        multiple: false,
        types: [
          { description: "JSON", accept: { "application/json": [".json"] } },
        ],
      });
      const text = await readBrowserFile(handle);
      lastOpenHandle = handle;
      void rememberPickerHandle(handle);
      return { name: handle.name, text, handle, diskText: text };
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return null;
      throw e;
    }
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      try {
        const text = await readJsonFile(f);
        resolve({ name: f.name, text });
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}
export async function saveFile(
  doc: Opened,
  text: string,
  saveAs = false,
): Promise<{
  name: string;
  token?: string;
  handle?: BrowserHandle;
  diskText?: string;
  confirmed?: boolean;
} | null> {
  if (desktop)
    return invoke("save_document", {
      token: doc.token ?? null,
      name: doc.name,
      text,
      saveAs,
    });
  if (doc.handle) {
    if ((await readBrowserFile(doc.handle)) !== doc.diskText)
      throw new Error(
        "The file changed in another editor. Reopen it or use Save as to keep your edits separately.",
      );
    const stream = await doc.handle.createWritable();
    try {
      if ((await readBrowserFile(doc.handle)) !== doc.diskText)
        throw new Error(
          "The file changed before saving. Reopen it or use Save as.",
        );
      await stream.write(text);
      await stream.close();
    } catch (e) {
      await stream.abort().catch(() => {});
      throw e;
    }
    return {
      name: doc.handle.name,
      handle: doc.handle,
      diskText: text,
      confirmed: true,
    };
  }
  const url = URL.createObjectURL(
    new Blob([new TextEncoder().encode(text)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { name: doc.name };
}
export async function discard() {
  return desktop
    ? invoke<boolean>("confirm_discard")
    : confirm("Discard unsaved changes? Cancel to return and save your work.");
}
export async function release(token?: string) {
  if (desktop && token) await invoke("release_document", { token });
}

export async function reloadFile(doc: Opened): Promise<Opened | null> {
  if (doc.handle) {
    const text = await readBrowserFile(doc.handle);
    return { ...doc, name: doc.handle.name, text, diskText: text };
  }
  return openFile();
}
