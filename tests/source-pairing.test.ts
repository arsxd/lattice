import { expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import {
  closeBrackets,
  deleteBracketPair,
  insertBracket,
} from "@codemirror/autocomplete";

const state = (doc = "", anchor = doc.length, head = anchor) =>
  EditorState.create({
    doc,
    selection: { anchor, head },
    extensions: [json(), closeBrackets()],
  });
it("pairs JSON quotes, braces and brackets and skips inserted closing characters", () => {
  for (const [open, close] of [
    ['"', '"'],
    ["{", "}"],
    ["[", "]"],
  ]) {
    const transaction = insertBracket(state(), open)!;
    expect(transaction.state.doc.toString()).toBe(open + close);
    expect(transaction.state.selection.main.head).toBe(1);
    const skip = insertBracket(transaction.state, close)!;
    expect(skip.state.doc.toString()).toBe(open + close);
    expect(skip.state.selection.main.head).toBe(2);
  }
});
it("deletes an empty pair as a unit and wraps selected text", () => {
  const paired = insertBracket(state(), "[")!.state;
  let result = paired;
  expect(
    deleteBracketPair({
      state: paired,
      dispatch: (tr) => {
        result = tr.state;
      },
    }),
  ).toBe(true);
  expect(result.doc.toString()).toBe("");
  expect(insertBracket(state("value", 0, 5), '"')!.state.doc.toString()).toBe(
    '"value"',
  );
});
it("leaves escaped quotes and ordinary character insertion to the editor", () => {
  const escaped = state('"a\\"', 3);
  expect(insertBracket(escaped, '"')).toBeNull();
  expect(insertBracket(state(), "x")).toBeNull();
  expect(insertBracket(state(), "'")).toBeNull();
});
