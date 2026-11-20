import {
  RangeSet,
  StateEffect,
  StateField,
  type EditorState,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutter,
  lineNumberMarkers,
  ViewPlugin,
  WidgetType,
  hoverTooltip,
  showTooltip,
  type ViewUpdate,
} from "@codemirror/view";
import type { Diagnostic } from "../document/engine";
import { jsonDiagnosticTitle } from "./JsonProblem";
import { validateSourceDraft } from "./sourceValidation";

type Issue = { from: number; to: number; message: string };
export function sourceIssues(
  state: EditorState,
  diagnostics: Diagnostic[],
): Issue[] {
  return diagnostics.slice(0, 100).map((issue) => {
    const line = state.doc.line(
      Math.max(1, Math.min(state.doc.lines, issue.line)),
    );
    const position = Math.min(
      line.to,
      line.from + Math.max(0, issue.column - 1),
    );
    const from = position;
    return {
      from,
      to:
        issue.message === "UnexpectedEndOfString"
          ? line.to
          : Math.min(line.to, from + 1),
      message: `${jsonDiagnosticTitle(issue.message)} Line ${issue.line}, column ${issue.column}.`,
    };
  });
}
const setIssues = StateEffect.define<Issue[]>();
class EmptyIssue extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "source-syntax-error source-syntax-error-empty";
    span.textContent = "\u00a0";
    return span;
  }
}
const issues = StateField.define<Issue[]>({
  create: () => [],
  update(value, transaction) {
    if (transaction.docChanged) value = [];
    for (const effect of transaction.effects)
      if (effect.is(setIssues)) value = effect.value;
    return value;
  },
  provide: (field) =>
    EditorView.decorations.compute([field], (state) =>
      Decoration.set(
        state
          .field(field)
          .map((issue) =>
            issue.from === issue.to
              ? Decoration.widget({ widget: new EmptyIssue() }).range(
                  issue.from,
                )
              : Decoration.mark({ class: "source-syntax-error" }).range(
                  issue.from,
                  issue.to,
                ),
          ),
        true,
      ),
    ),
});

function syntaxTooltip(issue: Issue) {
  return {
    pos: issue.from,
    end: issue.to,
    above: true,
    create() {
      const dom = document.createElement("div");
      dom.className = "source-syntax-message";
      dom.textContent = issue.message;
      dom.setAttribute("role", "note");
      return { dom };
    },
  };
}
const setGutterIssue = StateEffect.define<Issue | null>();
const gutterIssue = StateField.define<Issue | null>({
  create: () => null,
  update(value, transaction) {
    if (transaction.docChanged || transaction.selection) value = null;
    for (const effect of transaction.effects)
      if (effect.is(setGutterIssue)) value = effect.value;
    return value;
  },
  provide: (field) =>
    showTooltip.from(field, (issue) => (issue ? syntaxTooltip(issue) : null)),
});

class SyntaxMarker extends GutterMarker {
  constructor(
    readonly message: string,
    readonly lineNumber?: number,
    readonly errorLine = lineNumber ?? 0,
  ) {
    super();
  }
  eq(other: SyntaxMarker) {
    return (
      this.message === other.message &&
      this.lineNumber === other.lineNumber &&
      this.errorLine === other.errorLine
    );
  }
  toDOM() {
    const marker = document.createElement("span");
    marker.className =
      this.lineNumber === undefined
        ? "source-syntax-marker"
        : "source-syntax-line-number";
    if (this.lineNumber !== undefined)
      marker.textContent = String(this.lineNumber);
    marker.dataset.syntaxMessage = this.message;
    marker.dataset.syntaxLine = String(this.errorLine);
    if (this.lineNumber === undefined) marker.setAttribute("role", "img");
    marker.setAttribute("aria-label", `Syntax error: ${this.message}`);
    return marker;
  }
}

export const sourceDiagnostics = [
  issues,
  gutterIssue,
  lineNumberMarkers.compute([issues], (state) => {
    const lines = new Map<number, string[]>();
    for (const issue of state.field(issues)) {
      const from = state.doc.lineAt(issue.from).from;
      lines.set(from, [...(lines.get(from) ?? []), issue.message]);
    }
    return RangeSet.of(
      [...lines].map(([from, messages]) =>
        new SyntaxMarker(
          [...new Set(messages)].join("\n"),
          state.doc.lineAt(from).number,
        ).range(from),
      ),
      true,
    );
  }),
  gutter({
    class: "source-syntax-gutter",
    lineMarker(view, line) {
      const messages = view.state
        .field(issues)
        .filter((issue) => view.state.doc.lineAt(issue.from).from === line.from)
        .map((issue) => issue.message);
      return messages.length
        ? new SyntaxMarker(
            [...new Set(messages)].join("\n"),
            undefined,
            view.state.doc.lineAt(line.from).number,
          )
        : null;
    },
    lineMarkerChange: (update) =>
      update.startState.field(issues) !== update.state.field(issues),
  }),
  ViewPlugin.define((view) => {
    let timer: ReturnType<typeof setTimeout>;
    let pending: AbortController | undefined;
    let alive = true;
    let hoverTimer: ReturnType<typeof setTimeout> | undefined;
    let hovered: HTMLElement | null = null;
    const hideGutter = () => {
      clearTimeout(hoverTimer);
      hovered = null;
      if (view.state.field(gutterIssue))
        view.dispatch({ effects: setGutterIssue.of(null) });
    };
    const over = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-syntax-message]")
          : null;
      if (!target || target === hovered) return;
      hideGutter();
      hovered = target;
      hoverTimer = setTimeout(() => {
        if (!alive || !target.isConnected || hovered !== target) return;
        const line = Number(target.dataset.syntaxLine);
        const issue = view.state
          .field(issues)
          .find((item) => view.state.doc.lineAt(item.from).number === line);
        if (issue)
          view.dispatch({
            effects: setGutterIssue.of({
              ...issue,
              message: target.dataset.syntaxMessage!,
            }),
          });
      }, 300);
    };
    const out = (event: MouseEvent) => {
      if (
        hovered &&
        !(
          event.relatedTarget instanceof Node &&
          hovered.contains(event.relatedTarget)
        )
      )
        hideGutter();
    };
    view.dom.addEventListener("mouseover", over);
    view.dom.addEventListener("mouseout", out);
    view.scrollDOM.addEventListener("scroll", hideGutter);

    const schedule = () => {
      clearTimeout(timer);
      pending?.abort();
      timer = setTimeout(() => {
        const doc = view.state.doc;
        const controller = (pending = new AbortController());
        void validateSourceDraft(view.state.sliceDoc(), controller.signal)
          .then((diagnostics) => {
            if (alive && !controller.signal.aborted && view.state.doc === doc)
              view.dispatch({
                effects: setIssues.of(sourceIssues(view.state, diagnostics)),
              });
          })
          .catch(() => {
            // Inline checks are advisory; Apply retains its explicit validation errors.
          });
      }, 800);
    };
    schedule();
    return {
      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet) {
          clearTimeout(hoverTimer);
          hovered = null;
        }
        if (update.docChanged) schedule();
      },
      destroy() {
        alive = false;
        clearTimeout(timer);
        clearTimeout(hoverTimer);
        view.dom.removeEventListener("mouseover", over);
        view.dom.removeEventListener("mouseout", out);
        view.scrollDOM.removeEventListener("scroll", hideGutter);
        pending?.abort();
      },
    };
  }),
  hoverTooltip(
    (view, position) => {
      const issue = view.state
        .field(issues)
        .find((item) => position >= item.from && position <= item.to);
      return issue ? syntaxTooltip(issue) : null;
    },
    { hideOnChange: true, hoverTime: 300 },
  ),
];
