import { useEffect, useRef, useState } from "react";
import { MergeView } from "@codemirror/merge";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  lineNumbers,
  drawSelection,
  highlightActiveLine,
} from "@codemirror/view";
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
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
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
  }, [before, after, collapsed]);
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
      <div className="diff-headings">
        <strong>Saved / opened</strong>
        <strong>Current document</strong>
      </div>
      <div className="diff-host" ref={parent} />
    </section>
  );
}
