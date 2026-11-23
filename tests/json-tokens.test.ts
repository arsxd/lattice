import { expect, it } from "vitest";
import fc from "fast-check";
import { COLOUR_LIMIT, tokenizeJsonPreview } from "../src/grid/jsonTokens";
const coloured = (text: string) =>
  tokenizeJsonPreview(text)
    .filter((t) => t.kind !== "plain")
    .map((t) => [t.kind, text.slice(t.start, t.end)]);
it("colours values but not keys or punctuation", () => {
  expect(
    coloured(
      '{"edition": 3, "lang": "en", "ok": true, "n": null, "x": -1.5e3}',
    ),
  ).toEqual([
    ["number", "3"],
    ["string", '"en"'],
    ["literal", "true"],
    ["literal", "null"],
    ["number", "-1.5e3"],
  ]);
});
it("treats strings before a colon as keys, even with spaces, and colours array items", () => {
  expect(coloured('{"a" : ["x", 2, false]}')).toEqual([
    ["string", '"x"'],
    ["number", "2"],
    ["literal", "false"],
  ]);
});
it("keeps escaped quotes inside one string and handles a preview cut off mid-string", () => {
  expect(coloured('["a\\"b", "cut')).toEqual([
    ["string", '"a\\"b"'],
    ["string", '"cut'],
  ]);
  expect(coloured('{"k": "abc…')).toEqual([["string", '"abc…']]);
});
it("covers every character exactly once, whatever the text", () => {
  fc.assert(
    fc.property(fc.string({ maxLength: COLOUR_LIMIT * 2 }), (text) => {
      const tokens = tokenizeJsonPreview(text);
      let at = 0;
      for (const t of tokens) {
        expect(t.start).toBe(at);
        expect(t.end).toBeGreaterThan(t.start);
        at = t.end;
      }
      expect(at).toBe(text.length);
    }),
    { numRuns: 200 },
  );
});
it("leaves text past the colour limit plain", () => {
  const text = "[" + "1,".repeat(COLOUR_LIMIT) + "]";
  const tokens = tokenizeJsonPreview(text);
  expect(tokens.at(-1)).toMatchObject({ kind: "plain", end: text.length });
  expect(tokens.filter((t) => t.kind === "number").length).toBeLessThan(
    COLOUR_LIMIT,
  );
});
