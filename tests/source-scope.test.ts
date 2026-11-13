import { expect, it } from "vitest";
import {
  applyScopedDraft,
  scopedSelectionRange,
  scopedSourceText,
  sourceRawRangeToDocument,
  type SourceScope,
} from "../src/editor/sourceScope";
const canonical =
  '{\r\n "before":900719925474099312345,\r\n "rows":[{"text":"a\\\"b"}],\r\n "after":true\r\n}';
const from = canonical.indexOf("["),
  to = canonical.indexOf("]") + 1;
const scope: SourceScope = { path: ["rows"], from, to };
it("extracts exact nested JSON and preserves siblings during incomplete edits", () => {
  expect(scopedSourceText(canonical, canonical, scope)).toBe(
    '[{"text":"a\\\"b"}]',
  );
  const draft = '[{"text":';
  const full = applyScopedDraft(canonical, scope, draft);
  expect(full).toBe(canonical.slice(0, from) + draft + canonical.slice(to));
  expect(scopedSourceText(full, canonical, scope)).toBe(draft);
});
it("supports whole-document and root scopes without parsing", () => {
  expect(scopedSourceText(canonical, canonical, null)).toBe(canonical);
  expect(applyScopedDraft(canonical, null, '{"draft":')).toBe('{"draft":');
  expect(
    scopedSourceText('{"draft":', canonical, {
      path: [],
      from: 0,
      to: canonical.length,
    }),
  ).toBe('{"draft":');
});
it("rejects edits outside scope and invalid ranges", () => {
  expect(() =>
    scopedSourceText(canonical.replace("true", "false"), canonical, scope),
  ).toThrow();
  expect(() =>
    scopedSourceText(canonical.replace("9007", "8007"), canonical, scope),
  ).toThrow();
  for (const bad of [
    { ...scope, from: -1 },
    { ...scope, to: canonical.length + 1 },
    { ...scope, from: to + 1 },
    { ...scope, from: 0.5 },
  ])
    expect(() => applyScopedDraft(canonical, bad, "[]")).toThrow();
});
it("clips located values and returns scope-relative raw offsets", () => {
  expect(scopedSelectionRange({ from: from + 1, to: to - 1 }, scope)).toEqual({
    from: 1,
    to: to - from - 1,
  });
  expect(
    scopedSelectionRange({ from: 0, to: canonical.length }, scope),
  ).toEqual({ from: 0, to: to - from });
  expect(scopedSelectionRange({ from: 0, to: from }, scope)).toBeNull();
});
it("converts CRLF positions and preserves UTF16 surrogate offsets", () => {
  const text = '[\r\n "😀",\r\n 123\r\n]',
    start = text.indexOf("123");
  expect(
    sourceRawRangeToDocument(text, { from: start, to: start + 3 }),
  ).toEqual({ from: start - 2, to: start + 1 });
  expect(sourceRawRangeToDocument(text, { from: -1, to: 0 })).toBeNull();
  expect(
    sourceRawRangeToDocument(text, { from: 0, to: text.length + 1 }),
  ).toBeNull();
});

it("uses the full document separator for mixed line endings", () => {
  const text = "one\ntwo\r\nthree";
  expect(sourceRawRangeToDocument(text, { from: 4, to: text.length })).toEqual({
    from: 4,
    to: text.length - 1,
  });
});
