import { sourceLineSeparator, sourceTextMatches } from "./sourceText";
import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  lineNumbers,
  drawSelection,
  highlightActiveLine,
  keymap,
} from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";
import { json } from "@codemirror/lang-json";
export function SourceEditor({
  value,
  onChange,
  target,
}: {
  value: string;
  target?: { from: number; to: number; id: number } | null;
  onChange: (text: string) => void;
}) {
  const parent = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  const syncing = useRef(false);
  const callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => {
    if (!parent.current) return;
    const editor = new EditorView({
      parent: parent.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          EditorState.lineSeparator.of(sourceLineSeparator(value)),
          lineNumbers(),
          drawSelection(),
          highlightActiveLine(),
          json(),
          syntaxHighlighting(defaultHighlightStyle),
          keymap.of([...defaultKeymap, indentWithTab]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !syncing.current)
              callback.current(update.state.sliceDoc());
          }),
          EditorView.contentAttributes.of({
            "aria-label": "JSON source draft",
          }),
          EditorView.theme({
            "&": { height: "100%", fontSize: "13px" },
            ".cm-scroller": {
              overflow: "auto",
              fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
            },
            ".cm-content": { padding: "12px 0" },
            ".cm-gutters": {
              background: "var(--chrome)",
              color: "var(--muted)",
              borderRight: "1px solid var(--line)",
            },
          }),
        ],
      }),
    });
    view.current = editor;
    return () => editor.destroy();
  }, []);
  useEffect(() => {
    const editor = view.current;
    if (editor && !sourceTextMatches(editor.state, value)) {
      syncing.current = true;
      try {
        editor.dispatch({
          changes: { from: 0, to: editor.state.doc.length, insert: value },
        });
      } finally {
        syncing.current = false;
      }
    }
  }, [value]);
  useEffect(() => {
    const editor = view.current;
    if (!editor || !target) return;
    if (target.to > editor.state.doc.length) return;
    editor.dispatch({
      selection: { anchor: target.from, head: target.to },
      effects: EditorView.scrollIntoView(target.from, { y: "center" }),
    });
    editor.focus();
  }, [target]);
  return <div className="source-editor" ref={parent} />;
}
