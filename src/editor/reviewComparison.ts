import { Change } from "@codemirror/merge";
import { diffChars, diffLines } from "diff";

// Compare lines before characters. CodeMirror's character scan limit can otherwise
// turn a few distant edits into one huge replacement containing unchanged lines.
export function compareReviewText(
  before: string,
  after: string,
  limits: { timeout?: number; maxEditLength?: number } = {},
): { changes: Change[]; complete: boolean } {
  if (before === after) return { changes: [], complete: true };
  const timeout = limits.timeout ?? 200;
  const maxEditLength = limits.maxEditLength ?? 20_000;
  const deadline = performance.now() + timeout;
  const lines = diffLines(before, after, { timeout, maxEditLength });
  if (!lines) return { changes: [], complete: false };
  const changes: Change[] = [];
  let a = 0,
    b = 0,
    startA = -1,
    startB = -1;
  function flush(): boolean {
    if (startA < 0) return true;
    if (startA === a || startB === b) {
      changes.push(new Change(startA, a, startB, b));
    } else {
      const remaining = deadline - performance.now();
      if (remaining <= 0) return false;
      const parts = diffChars(before.slice(startA, a), after.slice(startB, b), {
        timeout: remaining,
        maxEditLength: Math.min(maxEditLength, 4000),
      });
      if (!parts) return false;
      let x = startA,
        y = startB,
        fromA = -1,
        fromB = -1;
      const finish = () => {
        if (fromA >= 0) changes.push(new Change(fromA, x, fromB, y));
        fromA = fromB = -1;
      };
      for (const part of parts) {
        if (part.added || part.removed) {
          if (fromA < 0) {
            fromA = x;
            fromB = y;
          }
          if (part.removed) x += part.value.length;
          else y += part.value.length;
        } else {
          finish();
          x += part.value.length;
          y += part.value.length;
        }
      }
      finish();
    }
    startA = startB = -1;
    return true;
  }
  for (const line of lines) {
    if (line.added || line.removed) {
      if (startA < 0) {
        startA = a;
        startB = b;
      }
      if (line.removed) a += line.value.length;
      else b += line.value.length;
    } else {
      if (!flush()) return { changes: [], complete: false };
      a += line.value.length;
      b += line.value.length;
    }
  }
  return flush()
    ? { changes, complete: true }
    : { changes: [], complete: false };
}
