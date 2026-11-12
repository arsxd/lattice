import { validateDiffDraft } from "./diffDraft";
self.onmessage = ({ data }: MessageEvent<{ text: string }>) => {
  try {
    self.postMessage({ diagnostics: validateDiffDraft(data.text) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
