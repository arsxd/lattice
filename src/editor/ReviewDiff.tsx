import { useEffect, useRef, useState } from "react";
import { MergeView, goToNextChunk, goToPreviousChunk } from "@codemirror/merge";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { json } from "@codemirror/lang-json";
export default function ReviewDiff({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  const parent = useRef<HTMLDivElement>(null),
    merge = useRef<MergeView | null>(null);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!parent.current) return;
    const extensions = [
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      lineNumbers(),
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
          EditorView.contentAttributes.of({ "aria-label": "Saved version" }),
        ],
      },
      b: {
        doc: after,
        extensions: [
          ...extensions,
          EditorView.contentAttributes.of({ "aria-label": "Current version" }),
        ],
      },
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 8 },
      diffConfig: { scanLimit: 1000, timeout: 1000 },
    });
    merge.current = view;
    setCount(view.chunks.length);
    return () => {
      view.destroy();
      merge.current = null;
    };
  }, [before, after]);
  return (
    <section className="diff-review">
      <div className="diff-tools">
        <span>
          {count
            ? `${count} changed region${count === 1 ? "" : "s"}`
            : "No changes"}
        </span>
        <button
          disabled={!count}
          onClick={() => {
            const v = merge.current?.b;
            if (v) goToPreviousChunk(v);
          }}
        >
          Previous change
        </button>
        <button
          disabled={!count}
          onClick={() => {
            const v = merge.current?.b;
            if (v) goToNextChunk(v);
          }}
        >
          Next change
        </button>
      </div>
      <div className="diff-headings">
        <strong>Saved / opened</strong>
        <strong>Current document</strong>
      </div>
      <div className="diff-host" ref={parent} />
    </section>
  );
}
