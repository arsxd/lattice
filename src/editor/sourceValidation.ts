import type { Diagnostic } from "../document/engine";
import ValidationWorker from "./diffValidation.worker?worker&inline";

/** Explicit validation before Apply; incomplete typing never starts a check. */
export function validateSourceDraft(text: string): Promise<Diagnostic[]> {
  return new Promise((resolve, reject) => {
    const worker = new ValidationWorker();
    const timer = setTimeout(() => {
      worker.terminate();
      reject(
        new Error(
          "Checking the source took too long. Your draft is unchanged; try Apply source again.",
        ),
      );
    }, 30000);
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
    };
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
