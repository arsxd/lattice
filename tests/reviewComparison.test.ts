import fc from "fast-check";
import { expect, it } from "vitest";
import { compareReviewText } from "../src/editor/reviewComparison";
it("keeps unchanged JSON lines outside changes when edits are far apart", () => {
  const before = JSON.stringify(
    Array.from({ length: 240 }, (_, id) => ({
      id,
      logo: null,
      name: null,
      prices: Array.from({ length: 24 }, (_, i) => ({
        amount: i,
        category: "regular",
      })),
    })),
    null,
    2,
  );
  let after = before;
  for (const id of [1, 40, 80, 120, 160, 200])
    after = after.replace(`"id": ${id},`, '"id": 445,');
  const result = compareReviewText(before, after);
  expect(result.complete).toBe(true);
  expect(result.changes).toHaveLength(6);
  for (const change of result.changes) {
    expect(before.slice(change.fromA, change.toA)).toMatch(/^\d+$/);
    expect(after.slice(change.fromB, change.toB)).toMatch(/^\d+$/);
  }
});
it("handles inserted and removed lines without losing offsets or Unicode", () => {
  const a = '[\n  "α",\n  "keep",\n  "remove"\n]\n',
    b = '[\n  "α",\n  "insert",\n  "keep"\n]\n';
  const result = compareReviewText(a, b);
  let restored = a;
  for (const change of [...result.changes].reverse())
    restored =
      restored.slice(0, change.fromA) +
      b.slice(change.fromB, change.toB) +
      restored.slice(change.toA);
  expect(restored).toBe(b);
  expect(result.complete).toBe(true);
});
it("reports an exhausted budget instead of inventing broad replacements", () => {
  expect(
    compareReviewText("before\n", "after\n", { maxEditLength: 0 }),
  ).toEqual({ changes: [], complete: false });
});
it("retains exact emoji, whitespace, and newline changes", () => {
  for (const [a, b] of [
    ["😀 α\nkeep\n", "😀 β\nkeep\n"],
    ["a\n", "a"],
    ["a", "a\n"],
    [" x\n", "  x\n"],
  ]) {
    const result = compareReviewText(a, b);
    let text = a;
    for (const c of [...result.changes].reverse())
      text =
        text.slice(0, c.fromA) + b.slice(c.fromB, c.toB) + text.slice(c.toA);
    expect(result.complete).toBe(true);
    expect(text).toBe(b);
  }
});
it("creates precise display chunks rather than one large unchanged region", async () => {
  const { Chunk } = await import("@codemirror/merge");
  const { sourceDocumentText } = await import("../src/editor/sourceText");
  const before = Array.from(
    { length: 1000 },
    (_, i) => `{"id":${i},"unchanged":"${"x".repeat(100)}"}\n`,
  ).join("");
  let after = before;
  for (const id of [1, 200, 400, 600, 800, 999])
    after = after.replace(`"id":${id},`, '"id":445,');
  const chunks = Chunk.build(
    sourceDocumentText(before),
    sourceDocumentText(after),
    { override: (a, b) => compareReviewText(a, b).changes },
  );
  expect(chunks).toHaveLength(6);
  expect(chunks.every((c) => c.toA - c.fromA < 200)).toBe(true);
});

it("reconstructs arbitrary small text changes with exact UTF-16 offsets", () => {
  const text = fc
    .array(fc.constantFrom("a", "b", "\n", "\r", "😀", "α", " ", "\t"), {
      maxLength: 60,
    })
    .map((parts) => parts.join(""));
  fc.assert(
    fc.property(text, text, (before, after) => {
      const result = compareReviewText(before, after);
      expect(result.complete).toBe(true);
      let restored = before;
      for (const c of [...result.changes].reverse())
        restored =
          restored.slice(0, c.fromA) +
          after.slice(c.fromB, c.toB) +
          restored.slice(c.toA);
      expect(restored).toBe(after);
    }),
    { numRuns: 250 },
  );
});
