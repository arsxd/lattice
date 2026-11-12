import { Text, EditorState } from "@codemirror/state";
export function sourceLineSeparator(text: string) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}
export function sourceTextMatches(state: EditorState, text: string) {
  return state.toText(text).eq(state.doc);
}

// Text inserts bypass the old state's line-separator parsing during reconfiguration.
export function sourceDocumentText(text: string) {
  return Text.of(text.split(sourceLineSeparator(text)));
}
export function sourceRestoreChange(
  source: Text,
  destination: Text,
  chunk: { fromA: number; toA: number; fromB: number; toB: number },
) {
  let insert = source.slice(chunk.fromA, Math.max(chunk.fromA, chunk.toA - 1));
  if (chunk.fromA !== chunk.toA && chunk.toB <= destination.length)
    insert = insert.append(Text.of(["", ""]));
  return {
    from: chunk.fromB,
    to: Math.min(destination.length, chunk.toB),
    insert,
  };
}
