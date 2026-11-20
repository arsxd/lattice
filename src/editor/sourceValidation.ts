import type { Diagnostic } from "../document/engine";
import ValidationWorker from "./diffValidation.worker?worker&inline";

/** Worker validation shared by Apply and quiet, cancellable inline checks. */
export function validateSourceDraft(
  text: string,
  signal?: AbortSignal,
): Promise<Diagnostic[]> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Validation cancelled", "AbortError"));
      return;
    }
    const worker = new ValidationWorker();
    const timer = setTimeout(() => {
      finish();
      reject(
        new Error(
          "Checking the source took too long. Your draft is unchanged; try Apply source again.",
        ),
      );
    }, 30000);
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      finish();
      reject(new DOMException("Validation cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }) => {
      finish();
      if (data.error) reject(new Error(data.error));
      else resolve(data.diagnostics);
    };
    worker.onerror = () => {
      finish();
      reject(
        new Error(
          "Could not check the source. Your draft is unchanged; try Apply source again.",
        ),
      );
    };
    worker.postMessage({ text });
  });
}
