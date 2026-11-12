import { useEffect, useRef, useState } from "react";
import { MergeView } from "@codemirror/merge";
import { Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  lineNumbers,
  drawSelection,
  highlightActiveLine,
  keymap,
} from "@codemirror/view";
import { json } from "@codemirror/lang-json";
import {
  defaultKeymap,
  history,
  historyKeymap,
  undo,
  redo,
} from "@codemirror/commands";
import ValidationWorker from "./diffValidation.worker?worker&inline";
import type { Diagnostic } from "../document/engine";
import {
  sourceLineSeparator,
  sourceDocumentText,
  sourceRestoreChange,
} from "./sourceText";
export default function ReviewDiff({
  before,
  after,
  initialDraft,
  onChange,
  onApply,
  busy = false,
}: {
  before: string;
  after: string;
  initialDraft?: string;
  onChange?: (draft: string) => void;
  onApply?: (draft: string) => Promise<void>;
  busy?: boolean;
}) {
  const parent = useRef<HTMLDivElement>(null),
    merge = useRef<MergeView | null>(null);
  const callbacks = useRef({ onChange, onApply });
  callbacks.current = { onChange, onApply };
  const initialText = useRef(initialDraft ?? after);
  const lastAfter = useRef(after);
  const [draft, setDraft] = useState(initialText.current);
  const draftRef = useRef(initialText.current);
  const [validation, setValidation] = useState<{
    text: string;
    diagnostics: Diagnostic[];
  } | null>(null);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);
  const validator = useRef<Worker | null>(null);
  const separator = useRef(new Compartment());
  const editable = useRef(new Compartment());
  const baselineSeparator = useRef(new Compartment());
  const [validationRequest, setValidationRequest] = useState(0);
  const [count, setCount] = useState(0);
  const [collapsed, setCollapsed] = useState(true);
  const [active, setActive] = useState(-1);
  function jump(direction: number) {
    const view = merge.current;
    if (!view || !count) return;
    const index =
      active < 0
        ? direction > 0
          ? 0
          : count - 1
        : (active + direction + count) % count;
    const chunk = view.chunks[index];
    if (!chunk) return;
    for (const [editor, from, to] of [
      [view.a, chunk.fromA, chunk.toA],
      [view.b, chunk.fromB, chunk.toB],
    ] as const) {
      const start = Math.min(from, editor.state.doc.length),
        end = Math.min(to, editor.state.doc.length);
      editor.dispatch({
        selection: { anchor: start, head: end },
        effects: EditorView.scrollIntoView(start, { y: "center" }),
      });
    }
    view.b.focus();
    setActive(index);
  }
  useEffect(() => {
    if (!parent.current) return;
    const extensions = [
      lineNumbers(),
      drawSelection(),
      highlightActiveLine(),
      json(),
      EditorView.theme({
        "&": { fontSize: "13px" },
        ".cm-scroller": { fontFamily: "ui-monospace, Consolas, monospace" },
        ".cm-gutters": { background: "var(--chrome)", color: "var(--muted)" },
      }),
    ];
    const view = new MergeView({
      parent: parent.current,
      a: {
        doc: before,
        extensions: [
          ...extensions,
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          baselineSeparator.current.of(
            EditorState.lineSeparator.of(sourceLineSeparator(before)),
          ),
          EditorView.contentAttributes.of({ "aria-label": "Saved version" }),
        ],
      },
      b: {
        doc: sourceDocumentText(initialText.current),
        extensions: [
          ...extensions,
          separator.current.of(
            EditorState.lineSeparator.of(
              sourceLineSeparator(initialText.current),
            ),
          ),
          editable.current.of([]),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const text = update.state.sliceDoc();
              draftRef.current = text;
              setDraft(text);
              callbacks.current.onChange?.(text);
              setActive(-1);
              // MergeView updates its chunks before notifying view listeners.
              queueMicrotask(() => {
                if (merge.current) setCount(merge.current.chunks.length);
              });
            }
          }),
          EditorView.contentAttributes.of({
            "aria-label": "Current JSON draft",
          }),
        ],
      },
      revertControls: "a-to-b",
      renderRevertControl: () => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Restore";
        button.title =
          "Restore this region from saved version into draft (undoable)";
        button.setAttribute(
          "aria-label",
          "Restore this changed region from saved version into draft",
        );
        button.addEventListener("click", (event) => {
          // MergeView's default handler serializes through the baseline separator.
          // Copy Text directly so restored logical lines use the draft separator.
          event.preventDefault();
          event.stopPropagation();
          const view = merge.current;
          const index = Number(button.dataset.chunk);
          const chunk = view?.chunks[index];
          if (!view || !chunk || view.b.state.readOnly) return;
          view.b.dispatch({
            changes: sourceRestoreChange(
              view.a.state.doc,
              view.b.state.doc,
              chunk,
            ),
            userEvent: "revert",
          });
        });
        return button;
      },
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: collapsed ? { margin: 3, minSize: 8 } : undefined,
      diffConfig: { scanLimit: 1000, timeout: 1000 },
    });
    merge.current = view;
    setCount(view.chunks.length);
    setActive(-1);
    return () => {
      view.destroy();
      merge.current = null;
    };
  }, []);
  useEffect(() => {
    const editor = merge.current?.a;
    if (editor && editor.state.sliceDoc() !== before)
      editor.dispatch({
        changes: {
          from: 0,
          to: editor.state.doc.length,
          insert: sourceDocumentText(before),
        },
        effects: baselineSeparator.current.reconfigure(
          EditorState.lineSeparator.of(sourceLineSeparator(before)),
        ),
      });
    if (merge.current) setCount(merge.current.chunks.length);
    setActive(-1);
  }, [before]);
  useEffect(() => {
    merge.current?.reconfigure({
      collapseUnchanged: collapsed ? { margin: 3, minSize: 8 } : undefined,
    });
  }, [collapsed]);
  useEffect(() => {
    if (lastAfter.current === after) return;
    lastAfter.current = after;
    const view = merge.current?.b;
    if (!view) return;
    if (view.state.sliceDoc() !== after) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: sourceDocumentText(after),
        },
        effects: separator.current.reconfigure(
          EditorState.lineSeparator.of(sourceLineSeparator(after)),
        ),
      });
    }
  }, [after]);
  useEffect(() => {
    setValidation(null);
    setValidating(false);
    const timer = setTimeout(() => {
      const worker = new ValidationWorker();
      validator.current = worker;
      setValidating(true);
      worker.onmessage = ({ data }) => {
        if (data.error) setError(data.error);
        else setValidation({ text: draft, diagnostics: data.diagnostics });
        setValidating(false);
        worker.terminate();
      };
      worker.onerror = () => {
        setError("Draft validation worker failed. Retry Validate.");
        setValidating(false);
        worker.terminate();
      };
      worker.postMessage({ text: draft });
    }, 400);
    return () => {
      clearTimeout(timer);
      validator.current?.terminate();
    };
  }, [draft, validationRequest]);
  useEffect(() => {
    const view = merge.current;
    if (!view) return;
    const locked = busy || applying;
    view.b.dispatch({
      effects: editable.current.reconfigure([
        EditorState.readOnly.of(locked),
        EditorView.editable.of(!locked),
      ]),
    });
    view.reconfigure({ revertControls: locked ? undefined : "a-to-b" });
  }, [busy, applying]);
  const valid =
    validation?.text === draft && validation.diagnostics.length === 0;
  async function apply() {
    if (!valid || busy || applying || !callbacks.current.onApply) return;
    setApplying(true);
    setError("");
    try {
      await callbacks.current.onApply(draftRef.current);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setApplying(false);
    }
  }
  function discard() {
    const editor = merge.current?.b;
    editor?.dispatch({
      changes: {
        from: 0,
        to: editor.state.doc.length,
        insert: sourceDocumentText(after),
      },
    });
  }
  return (
    <section className="diff-review">
      <div className="diff-tools">
        <span>
          {count
            ? active >= 0
              ? `Change ${active + 1} of ${count}`
              : `${count} changed region${count === 1 ? "" : "s"}`
            : "No changes"}
        </span>
        <button disabled={!count} onClick={() => jump(-1)}>
          Previous change
        </button>
        <button disabled={!count} onClick={() => jump(1)}>
          Next change
        </button>
        <button
          aria-pressed={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? "Show unchanged lines" : "Hide unchanged lines"}
        </button>
      </div>
      <div className="diff-tools">
        <button
          disabled={!valid || draft === after || busy || applying || !onApply}
          onClick={() => void apply()}
        >
          Apply changes
        </button>
        <button
          disabled={draft === after || busy || applying}
          onClick={discard}
        >
          Discard draft
        </button>
        <button
          disabled={validating}
          onClick={() => {
            setError("");
            setValidationRequest((n) => n + 1);
          }}
        >
          Validate
        </button>
        <button
          disabled={busy || applying}
          onClick={() => {
            if (merge.current) undo(merge.current.b);
          }}
        >
          Undo draft
        </button>
        <button
          disabled={busy || applying}
          onClick={() => {
            if (merge.current) redo(merge.current.b);
          }}
        >
          Redo draft
        </button>
        <span role="status">
          {validating
            ? "Validating…"
            : validation?.text === draft
              ? valid
                ? "Valid JSON"
                : `${validation.diagnostics.length} validation issue(s)`
              : "Validation pending"}
        </span>
      </div>
      {error && <p role="alert">{error}</p>}
      {validation?.text === draft && validation.diagnostics.length > 0 && (
        <p role="alert">
          {validation.diagnostics[0].message} (line{" "}
          {validation.diagnostics[0].line}, column{" "}
          {validation.diagnostics[0].column})
        </p>
      )}
      <div className="diff-headings">
        <strong>Saved / opened</strong>
        <strong>Current document</strong>
      </div>
      <div className="diff-host" ref={parent} />
    </section>
  );
}
