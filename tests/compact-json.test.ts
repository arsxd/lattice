import { it, expect } from "vitest";
import fc from "fast-check";
import { compactJson } from "../src/document/compactJson";
// Reference implementation: the original character-by-character version.
function reference(raw: string): string {
  let result = "",
    quoted = false,
    escaped = false;
  for (const char of raw) {
    if (quoted) {
      result += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') {
      quoted = true;
      result += char;
    } else if (!/\s/u.test(char))
      result += char === "," ? ", " : char === ":" ? ": " : char;
  }
  return result;
}
const piece = fc.oneof(
  fc.constantFrom(
    '"',
    "\\",
    ",",
    ":",
    " ",
    "\n",
    "\t",
    "\r",
    "{",
    "}",
    "[",
    "]",
    "1",
    "a",
    '\\"',
    "é",
    "😀",
    "\u00a0",
    "\u2028",
  ),
  fc.string({ maxLength: 4 }),
);
it("matches the reference implementation on arbitrary text and JSON", () => {
  fc.assert(
    fc.property(
      fc.array(piece, { maxLength: 40 }).map((a) => a.join("")),
      (s) => {
        expect(compactJson(s)).toBe(reference(s));
      },
    ),
    { numRuns: 30000 },
  );
  fc.assert(
    fc.property(fc.jsonValue(), (v) => {
      const t = JSON.stringify(v, null, 2);
      expect(compactJson(t)).toBe(reference(t));
    }),
    { numRuns: 3000 },
  );
});
