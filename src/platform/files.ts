import { readPickerHandle, rememberPickerHandle } from "./pickerMemory";
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
void readPickerHandle().then((handle) => {
  if (
    !lastOpenHandle &&
    handle &&
    typeof (handle as BrowserHandle).getFile === "function"
  )
    lastOpenHandle = handle as BrowserHandle;
});
export const browserSave = typeof pickers.showSaveFilePicker === "function";
export type Opened = {
  reviewUnavailable?: boolean;
  name: string;
  text: string;
  handle?: BrowserHandle;
  diskText?: string;
};
export async function readJsonFile(file: File): Promise<string> {
  if (!/\.json$/i.test(file.name))
    throw new Error(
      `"${file.name}" is not a .json file. Choose a UTF-8 JSON file.`,
    );
  if (file.size > 64 * 1024 * 1024)
    throw new Error(
      `"${file.name}" is too large. Lattice opens files up to 64 MiB.`,
    );
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            `Reading "${file.name}" took too long. Try opening it again. If it is stored online, download a local copy first.`,
          ),
        ),
      30000,
    );
    Promise.resolve()
      .then(() => file.arrayBuffer())
      .then(
        (bytes) => {
          clearTimeout(timer);
          resolve(bytes);
        },
        () => {
          clearTimeout(timer);
          reject(
            new Error(
              `"${file.name}" could not be read. Try opening it again or choose a local copy.`,
            ),
          );
        },
      );
  });
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
  const file = await new Promise<File>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            "Accessing the source file took too long. Use Open to choose it again, or try a local copy.",
          ),
        ),
      30000,
    );
    Promise.resolve()
      .then(() => handle.getFile())
      .then(
        (file) => {
          clearTimeout(timer);
          resolve(file);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
  });
  return readJsonFile(file);
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
  if (pickers.showOpenFilePicker) {
    try {
      const [handle] = await pickers.showOpenFilePicker({
        id: "lattice-open-json",
        ...(lastOpenHandle ? { startIn: lastOpenHandle } : {}),
        multiple: false,
        excludeAcceptAllOption: true,
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
    input.hidden = true;
    let reading = false,
      settled = false;
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      clearTimeout(resumeTimer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
      input.onchange = input.oninput = input.oncancel = null;
      input.remove();
    };
    const finish = (opened: Opened | null, error?: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error !== undefined) reject(error);
      else resolve(opened);
    };
    const readSelection = async () => {
      if (settled || reading) return;
      const file = input.files?.[0];
      if (!file) return;
      reading = true;
      try {
        finish({ name: file.name, text: await readJsonFile(file) });
      } catch (error) {
        finish(null, error);
      }
    };
    const resume = () => {
      if (document.visibilityState === "hidden") return;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        void readSelection();
      }, 0);
    };
    input.oncancel = () => {
      if (!reading) finish(null);
    };
    input.onchange = input.oninput = () => {
      void readSelection();
    };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    // Retain the input until its selected file has finished reading.
    document.body.append(input);
    try {
      input.click();
    } catch (error) {
      finish(null, error);
    }
  });
}
export async function saveFile(
  doc: Opened,
  text: string,
): Promise<{
  name: string;
  handle?: BrowserHandle;
  diskText?: string;
  confirmed?: boolean;
} | null> {
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
  return confirm(
    "Discard unsaved changes? Cancel to return and save your work.",
  );
}

export async function reloadFile(doc: Opened): Promise<Opened | null> {
  if (doc.handle) {
    const text = await readBrowserFile(doc.handle);
    return { ...doc, name: doc.handle.name, text, diskText: text };
  }
  return openFile();
}
