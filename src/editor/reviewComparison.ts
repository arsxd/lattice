import { Change } from "@codemirror/merge";
import { diffChars, diffLines } from "diff";

// Compare lines before characters. CodeMirror's character scan limit can otherwise
// turn a few distant edits into one huge replacement containing unchanged lines.
function compareRegion(
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

type Limits = { timeout?: number; maxEditLength?: number };
const lineStarts = (text: string): number[] => {
  const starts = [0];
  for (let i = text.indexOf("\n"); i >= 0; i = text.indexOf("\n", i + 1))
    starts.push(i + 1);
  return starts;
};

/**
 * Compare two versions of a document. A large document with a few edits makes
 * the line diff walk hundreds of thousands of identical lines and give up, so
 * the shared start and end are skipped first, and the rest is split at lines
 * that occur exactly once in both versions (which cannot be matched any other
 * way) and compared piece by piece, each with its own budget.
 */
export function compareReviewText(
  before: string,
  after: string,
  limits: Limits = {},
): { changes: Change[]; complete: boolean } {
  if (before === after) return { changes: [], complete: true };
  const A = lineStarts(before),
    B = lineStarts(after);
  const line = (text: string, starts: number[], i: number) =>
    text.slice(starts[i], i + 1 < starts.length ? starts[i + 1] : text.length);
  let head = 0;
  while (
    head < A.length &&
    head < B.length &&
    line(before, A, head) === line(after, B, head)
  )
    head++;
  let tail = 0;
  while (
    tail < A.length - head &&
    tail < B.length - head &&
    line(before, A, A.length - 1 - tail) === line(after, B, B.length - 1 - tail)
  )
    tail++;
  const middleA = [head, A.length - tail] as const,
    middleB = [head, B.length - tail] as const;
  // Lines that occur once on each side, in the same order, are fixed points.
  type Seen = { countA: number; a: number; countB: number; b: number };
  const seen = new Map<string, Seen>();
  for (let i = middleA[0]; i < middleA[1]; i++) {
    const key = line(before, A, i);
    const entry = seen.get(key) ?? { countA: 0, a: -1, countB: 0, b: -1 };
    entry.countA++;
    entry.a = i;
    seen.set(key, entry);
  }
  for (let j = middleB[0]; j < middleB[1]; j++) {
    const entry = seen.get(line(after, B, j));
    if (entry) {
      entry.countB++;
      entry.b = j;
    }
  }
  const anchors: [number, number][] = [];
  let lastB = middleB[0] - 1;
  for (let i = middleA[0]; i < middleA[1]; i++) {
    const entry = seen.get(line(before, A, i));
    if (!entry || entry.countA !== 1 || entry.countB !== 1) continue;
    if (entry.b > lastB) {
      anchors.push([i, entry.b]);
      lastB = entry.b;
    }
  }
  // Pieces between anchors; an anchor line itself is unchanged.
  const changes: Change[] = [];
  let a0 = middleA[0],
    b0 = middleB[0];
  const piece = (a1: number, b1: number): boolean => {
    if (a0 === a1 && b0 === b1) return true;
    const fromA = A[a0] ?? before.length,
      toA = a1 < A.length ? A[a1] : before.length,
      fromB = B[b0] ?? after.length,
      toB = b1 < B.length ? B[b1] : after.length;
    const result = compareRegion(
      before.slice(fromA, toA),
      after.slice(fromB, toB),
      limits,
    );
    if (!result.complete) return false;
    for (const c of result.changes)
      changes.push(
        new Change(
          c.fromA + fromA,
          c.toA + fromA,
          c.fromB + fromB,
          c.toB + fromB,
        ),
      );
    return true;
  };
  for (const [i, j] of anchors) {
    if (!piece(i, j)) return { changes: [], complete: false };
    a0 = i + 1;
    b0 = j + 1;
  }
  if (!piece(middleA[1], middleB[1])) return { changes: [], complete: false };
  return { changes, complete: true };
}
