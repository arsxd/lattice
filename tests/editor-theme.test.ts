import { expect, it } from "vitest";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { editorTheme } from "../src/editor/editorTheme";
it("switches editor appearance without replacing the draft", () => {
  const text = '{"n":9007199254740993,"unfinished":';
  const appearance = new Compartment();
  let state = EditorState.create({
    doc: text,
    extensions: appearance.of(editorTheme(false)),
  });
  expect(state.facet(EditorView.darkTheme)).toBe(false);
  for (const dark of [true, false]) {
    state = state.update({
      effects: appearance.reconfigure(editorTheme(dark)),
    }).state;
    expect(state.facet(EditorView.darkTheme)).toBe(dark);
    expect(state.sliceDoc()).toBe(text);
  }
});
