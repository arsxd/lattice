import DocumentWorker from "./document.worker?worker&inline";
export class DocumentClient {
  private worker = new DocumentWorker();
  private sequence = 0;
  private closed = false;
  private pending = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor() {
    this.worker.onmessage = ({ data }) => {
      const p = this.pending.get(data.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(data.id);
      if (data.error) p.reject(new Error(data.error));
      else p.resolve(data.value);
    };
    this.worker.onerror = () =>
      this.dispose(
        "Document worker failed. Reopen the original file; unsaved changes may be unavailable.",
      );
  }
  call<T = void>(action: string, args: unknown = {}): Promise<T> {
    if (this.closed)
      return Promise.reject(
        new Error("Document worker is closed. Reopen the file."),
      );
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(
        () =>
          this.dispose(
            "Document operation exceeded 30 seconds. Reopen the file to restart.",
          ),
        30000,
      );
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, action, args });
    });
  }
  dispose(message = "Document closed") {
    this.closed = true;
    this.worker.terminate();
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error(message));
    }
    this.pending.clear();
  }
}
