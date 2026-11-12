import { Chunk } from "@codemirror/merge";
import { expect, it } from "vitest";
import { Compartment, EditorState } from "@codemirror/state";
import {
  sourceLineSeparator,
  sourceDocumentText,
  sourceRestoreChange,
} from "../src/editor/sourceText";
it("canonical and discard replacements preserve LF to CRLF to LF exactly", () => {
  const compartment = new Compartment();
  let state = EditorState.create({
    doc: "[1]\n",
    extensions: compartment.of(EditorState.lineSeparator.of("\n")),
  });
  for (const text of ["[2]\r\n", "[3]\n", "[4]\r\n"]) {
    state = state.update({
      changes: {
        from: 0,
        to: state.doc.length,
        insert: sourceDocumentText(text),
      },
      effects: compartment.reconfigure(
        EditorState.lineSeparator.of(sourceLineSeparator(text)),
      ),
    }).state;
    expect(state.sliceDoc()).toBe(text);
    expect(state.doc.lines).toBe(2);
  }
});
it("restores LF baseline regions into CRLF draft without embedded LF or doubled CR", () => {
  const source = EditorState.create({
    doc: '{\n"n":900719925474099312345\n}\n',
  });
  let dest = EditorState.create({
    doc: '{\r\n"n":2\r\n}\r\n',
    extensions: EditorState.lineSeparator.of("\r\n"),
  });
  dest = dest.update({
    changes: sourceRestoreChange(
      source.doc,
      dest.doc,
      Chunk.build(source.doc, dest.doc)[0],
    ),
  }).state;
  expect(dest.sliceDoc()).toBe('{\r\n"n":900719925474099312345\r\n}\r\n');
  expect(dest.doc.lines).toBe(4);
});
it.each([
  ["[\r\n1,\r\n2\r\n]", "[\n1\n]"],
  ["[\n1\n]", "[\r\n1,\r\n2\r\n]"],
  ["[\n1\n]\n", "[\r\n1\r\n]"],
  ["[\r\n1\r\n]", "[\n1\n]\n"],
])(
  "restores insertion/deletion boundaries using destination line breaks",
  (before, after) => {
    const source = EditorState.create({
      doc: sourceDocumentText(before),
      extensions: EditorState.lineSeparator.of(sourceLineSeparator(before)),
    });
    let dest = EditorState.create({
      doc: sourceDocumentText(after),
      extensions: EditorState.lineSeparator.of(sourceLineSeparator(after)),
    });
    for (const chunk of Chunk.build(source.doc, dest.doc).reverse())
      dest = dest.update({
        changes: sourceRestoreChange(source.doc, dest.doc, chunk),
      }).state;
    expect(dest.sliceDoc()).toBe(
      before
        .split(sourceLineSeparator(before))
        .join(sourceLineSeparator(after)),
    );
  },
);
