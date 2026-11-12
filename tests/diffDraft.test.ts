import { DocumentEngine } from "../src/document/engine";

import { expect, it } from "vitest";
import { validateDiffDraft } from "../src/editor/diffDraft";
it("accepts exact large number tokens and CRLF without serialization", () => {
  const source = '{\r\n"id":900719925474099312345,"amount":1.2300e+9\r\n}';
  expect(validateDiffDraft(source)).toEqual([]);
});
it("reports invalid JSON and trailing comments using engine diagnostics", () => {
  expect(validateDiffDraft('{"a":}')[0]).toMatchObject({ line: 1 });
  expect(validateDiffDraft("{} // comment").length).toBeGreaterThan(0);
});
it("enforces engine nesting limits", () => {
  expect(
    validateDiffDraft("[".repeat(600) + "0" + "]".repeat(600)).length,
  ).toBeGreaterThan(0);
});
it("rejects invalid review apply without changing canonical text or undo history", () => {
  const engine = new DocumentEngine('{"n":9007199254740993}');
  expect(() => engine.source('{"n":', 0, true)).toThrow();
  expect(engine.text).toBe('{"n":9007199254740993}');
  expect(engine.revision).toBe(0);
  engine.source('{"n":1e400}', 0, true);
  engine.undo();
  expect(engine.text).toBe('{"n":9007199254740993}');
});
