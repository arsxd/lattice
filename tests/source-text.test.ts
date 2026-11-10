import { it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import {
  sourceLineSeparator,
  sourceTextMatches,
} from "../src/editor/sourceText";
it("opening CRLF source does not require a document rewrite", () => {
  const text = '{\r\n "value": 100\r\n}\r\n';
  const state = EditorState.create({
    doc: text,
    extensions: EditorState.lineSeparator.of(sourceLineSeparator(text)),
  });
  expect(sourceTextMatches(state, text)).toBe(true);
  expect(state.sliceDoc()).toBe(text);
});
it("editing then restoring source matches the committed text", () => {
  const text = '{\n "value":100\n}';
  const initial = EditorState.create({
    doc: text,
    extensions: EditorState.lineSeparator.of(sourceLineSeparator(text)),
  });
  const edited = initial.update({
    changes: { from: 0, to: initial.doc.length, insert: '{"draft":' },
  }).state;
  expect(sourceTextMatches(edited, text)).toBe(false);
  const restored = edited.update({
    changes: { from: 0, to: edited.doc.length, insert: text },
  }).state;
  expect(sourceTextMatches(restored, text)).toBe(true);
});
