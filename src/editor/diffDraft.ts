import { DocumentEngine, type Diagnostic } from "../document/engine";
export function validateDiffDraft(text: string): Diagnostic[] {
  try {
    return new DocumentEngine(text).diagnostics;
  } catch (error) {
    return [
      {
        message: error instanceof Error ? error.message : String(error),
        offset: 0,
        line: 1,
        column: 1,
      },
    ];
  }
}
