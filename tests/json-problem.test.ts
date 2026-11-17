import { it, expect } from "vitest";
import { jsonProblem } from "../src/editor/JsonProblem";
import { DocumentEngine } from "../src/document/engine";
it("identifies empty and whitespace-only documents without guessing other file formats", () => {
  for (const text of ["", "\ufeff\r\n  "])
    expect(jsonProblem(text, new DocumentEngine(text).diagnostics).title).toBe(
      "This document is empty.",
    );
  const text = "<html>not JSON</html>";
  expect(
    jsonProblem(text, new DocumentEngine(text).diagnostics).title,
  ).not.toMatch(/empty|HTML/);
});
it("explains a missing value while retaining an actionable location", () => {
  const text = '{ "name": }';
  const p = jsonProblem(text, new DocumentEngine(text).diagnostics);
  expect(p.title).toBe("A JSON value is missing.");
  expect(p.message).toContain("line 1, column");
  expect(p.message).toContain("Source");
});
