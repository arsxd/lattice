import { expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { sourceIssues } from "../src/editor/sourceDiagnostics";
import { validateDiffDraft } from "../src/editor/diffDraft";

it("locates missing commas in CRLF source without changing the draft", () => {
  const text = '{\r\n  "a": 1\r\n  "b": 2\r\n}';
  const state = EditorState.create({ doc: text });
  const result = sourceIssues(state, validateDiffDraft(text));
  expect(
    result.some((issue) => issue.message.includes("comma is missing")),
  ).toBe(true);
  expect(result[0].from).toBe(state.doc.line(3).from + 2);
  expect(state.sliceDoc()).toBe(text.replaceAll("\r\n", "\n"));
});

it("keeps end-of-file and empty-document markers within the document", () => {
  for (const text of ["", '{"a":', '{"a": 1']) {
    const state = EditorState.create({ doc: text });
    const result = sourceIssues(state, validateDiffDraft(text));
    expect(result.length).toBeGreaterThan(0);
    for (const issue of result) {
      expect(issue.from).toBeGreaterThanOrEqual(0);
      expect(issue.to).toBeLessThanOrEqual(state.doc.length);
      expect(issue.to).toBeGreaterThanOrEqual(issue.from);
    }
  }
  expect(
    sourceIssues(
      EditorState.create({ doc: '{"a": 1}' }),
      validateDiffDraft('{"a": 1}'),
    ),
  ).toEqual([]);
});

it("underlines unfinished strings to the end of their own line", () => {
  const text = '{\n  "created_at": "2015-01-01T15:00:00Z\n}';
  const state = EditorState.create({ doc: text });
  const result = sourceIssues(state, validateDiffDraft(text));
  const string = result.find((issue) =>
    issue.message.includes("closing double quote"),
  );
  expect(string).toBeDefined();
  expect(string!.from).toBe(text.indexOf('"2015'));
  expect(string!.to).toBe(state.doc.line(2).to);
});

it("uses an insertion marker rather than underlining a line break", () => {
  const state = EditorState.create({ doc: '{"a":\n}' });
  const result = sourceIssues(state, [
    { message: "ValueExpected", offset: 5, line: 1, column: 6 },
  ]);
  expect(result[0].from).toBe(state.doc.line(1).to);
  expect(result[0].to).toBe(result[0].from);
});
