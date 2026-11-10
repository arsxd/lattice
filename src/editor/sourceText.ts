import { EditorState } from "@codemirror/state";
export function sourceLineSeparator(text: string) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}
export function sourceTextMatches(state: EditorState, text: string) {
  return state.toText(text).eq(state.doc);
}
