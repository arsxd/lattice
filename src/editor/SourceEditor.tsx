import { openSearchPanel, search, searchKeymap } from "@codemirror/search";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { sourceDiagnostics } from "./sourceDiagnostics";
import { editorTheme } from "./editorTheme";
import { sourceLineSeparator, sourceTextMatches } from "./sourceText";
import { sourceRawRangeToDocument } from "./sourceScope";
import { useEffect, useRef } from "react";
import {
  EditorState,
  StateEffect,
  StateField,
  Compartment,
} from "@codemirror/state";
import {
  EditorView,
  lineNumbers,
  Decoration,
  GutterMarker,
  gutter,
  drawSelection,
  highlightActiveLineGutter,
  keymap,
} from "@codemirror/view";
import {
  history,
  historyKeymap,
  isolateHistory,
  redo,
  defaultKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";
import { json } from "@codemirror/lang-json";
const sourceLocation = StateEffect.define<{
  from: number;
  to: number;
} | null>();
const sourceLocationField = StateField.define<{
  from: number;
  to: number;
} | null>({
  create: () => null,
  update(location, transaction) {
    if (transaction.docChanged && location) {
      const from = transaction.changes.mapPos(location.from, -1);
      const to = transaction.changes.mapPos(location.to, 1);
      location = from < to ? { from, to } : null;
    }
    for (const effect of transaction.effects)
      if (effect.is(sourceLocation)) location = effect.value;
    return location;
  },
  provide: (field) =>
    EditorView.decorations.compute([field], (state) => {
      const location = state.field(field);
      if (!location || location.from >= location.to) return Decoration.none;
      const startLine = state.doc.lineAt(location.from);
      const marks = [
        Decoration.line({ class: "source-cell-arrival" }).range(startLine.from),
      ];
      marks.push(
        Decoration.mark({ class: "source-cell-location" }).range(
          location.from,
          location.to,
        ),
      );
      return Decoration.set(marks, true);
    }),
});
class SourceLocationMarker extends GutterMarker {
  toDOM() {
    const marker = document.createElement("span");
    marker.className = "source-cell-marker";
    marker.title = "Current table cell";
    marker.setAttribute("aria-label", "Current table cell");
    return marker;
  }
}
const sourceLocationMarker = new SourceLocationMarker();
const sourceLocationGutter = gutter({
  class: "source-location-gutter",
  lineMarker: (view, line) => {
    const location = view.state.field(sourceLocationField);
    if (!location) return null;
    const start = view.state.doc.lineAt(location.from).from;
    const end = view.state.doc.lineAt(
      Math.max(location.from, location.to - 1),
    ).from;
    return line.from >= start && line.from <= end ? sourceLocationMarker : null;
  },
  lineMarkerChange: (update) =>
    update.startState.field(sourceLocationField) !==
    update.state.field(sourceLocationField),
});

export function SourceEditor({
  value,
  dark,
  onChange,
  target,
  onFormatReady,
  formatSource,
  wrapLines,
  onLocateReady,
  onSearchReady,
  onLocationChange,
}: {
  value: string;
  dark: boolean;
  wrapLines: boolean;
  onSearchReady: (open: (() => void) | null) => void;
  onLocateReady: (locate: (() => void) | null) => void;
  onLocationChange: (available: boolean) => void;
  onFormatReady: (
    format: ((action: "pretty" | "compact" | "minify") => Promise<void>) | null,
  ) => void;
  formatSource: (
    text: string,
    action: "pretty" | "compact" | "minify",
  ) => Promise<string>;
  target?: { from: number; to: number; id: number } | null;
  onChange: (text: string) => void;
}) {
  const parent = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  const syncing = useRef(false);
  const appearance = useRef(new Compartment());
  const wrapping = useRef(new Compartment());
  const locationCallback = useRef(onLocationChange);
  locationCallback.current = onLocationChange;
  const callback = useRef(onChange);
  callback.current = onChange;
  const formatter = useRef(formatSource);
  formatter.current = formatSource;
  useEffect(() => {
    if (!parent.current) return;
    const editor = new EditorView({
      parent: parent.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          EditorState.lineSeparator.of(sourceLineSeparator(value)),
          history(),
          search({ top: true }),
          appearance.current.of(editorTheme(dark)),
          wrapping.current.of(wrapLines ? EditorView.lineWrapping : []),
          sourceLocationField,
          sourceLocationGutter,
          lineNumbers(),

          drawSelection(),
          highlightActiveLineGutter(),
          json(),
          closeBrackets(),
          sourceDiagnostics,
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          keymap.of([
            ...searchKeymap,
            ...closeBracketsKeymap,
            ...historyKeymap,
            // CodeMirror binds Ctrl-Y (and Ctrl-Shift-Z only on Linux); Windows users expect both.
            { key: "Mod-Shift-z", run: redo, preventDefault: true },
            ...defaultKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((update) => {
            if (
              update.startState.field(sourceLocationField) !==
              update.state.field(sourceLocationField)
            )
              locationCallback.current(
                !!update.state.field(sourceLocationField),
              );
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
    onLocateReady(() => {
      const location = editor.state.field(sourceLocationField);
      if (!location) return;
      editor.dispatch({
        effects: EditorView.scrollIntoView(location.from, { y: "center" }),
      });
      // Visible lines retain their DOM, so replay the completed arrival animation.
      editor.dom
        .querySelector(".source-cell-arrival")
        ?.getAnimations()
        .forEach((animation) => {
          animation.currentTime = 0;
          animation.play();
        });
    });
    onSearchReady(() => {
      openSearchPanel(editor);
    });
    let alive = true;
    onFormatReady(async (action) => {
      const original = editor.state.doc;
      const text = editor.state.sliceDoc();
      const formatted = await formatter.current(text, action);
      if (!alive) return;
      if (!editor.state.doc.eq(original))
        throw new Error(
          "The draft changed while formatting. Try again; your latest edits have been kept.",
        );
      if (formatted !== text)
        editor.dispatch({
          changes: { from: 0, to: editor.state.doc.length, insert: formatted },
          annotations: isolateHistory.of("full"),
          effects: sourceLocation.of(null),
        });
      editor.focus();
    });
    return () => {
      alive = false;
      onFormatReady(null);
      onLocateReady(null);
      onSearchReady(null);
      locationCallback.current(false);
      editor.destroy();
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- editor is created once; theme, wrapping and value update via their own effects
  }, []);
  useEffect(() => {
    view.current?.dispatch({
      effects: appearance.current.reconfigure(editorTheme(dark)),
    });
  }, [dark]);
  useEffect(() => {
    view.current?.dispatch({
      effects: wrapping.current.reconfigure(
        wrapLines ? EditorView.lineWrapping : [],
      ),
    });
  }, [wrapLines]);
  useEffect(() => {
    const editor = view.current;
    if (editor && !sourceTextMatches(editor.state, value)) {
      syncing.current = true;
      try {
        editor.dispatch({
          changes: { from: 0, to: editor.state.doc.length, insert: value },
          effects: sourceLocation.of(null),
        });
      } finally {
        syncing.current = false;
      }
    }
  }, [value]);
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    if (!target) {
      editor.dispatch({ effects: sourceLocation.of(null) });
      return;
    }
    const selection = sourceRawRangeToDocument(value, target);
    if (!selection || selection.to > editor.state.doc.length) return;
    editor.dispatch({
      effects: [
        sourceLocation.of(selection),
        EditorView.scrollIntoView(selection.from, { y: "center" }),
      ],
    });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- jump only when the target changes, not on every keystroke
  }, [target]);
  return <div className="source-editor" ref={parent} />;
}
