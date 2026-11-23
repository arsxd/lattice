import { ColumnMenuChevron } from "../grid/SheetIcons";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = {
  address: string;
  caption?: string;
  value: string;
  editable: boolean;
  previewOnly?: boolean;
  onOpenTable?: () => void;
  onCommit: (v: string) => Promise<void>;
  onCommitReady?: (commit: (() => Promise<boolean>) | null, hasChanges?: () => boolean) => void;
};

export function ValueBar(props: Props) {
  const identity = JSON.stringify([props.address, props.value]);
  const current = useRef(identity);
  current.current = identity;
  return (
    <ValueBarEditor
      key={identity}
      {...props}
      isCurrent={() => current.current === identity}
    />
  );
}

function ValueBarEditor({
  address,
  caption,
  value,
  editable,
  previewOnly = false,
  onOpenTable,
  onCommit,
  onCommitReady,
  isCurrent,
}: Props & { isCurrent: () => boolean }) {
  const [draft, setDraft] = useState(value);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(true);
  const pending = useRef<Promise<boolean> | null>(null);
  const committed = useRef(value);
  const draftRef = useRef(value);
  const readOnly = !editable || previewOnly;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useLayoutEffect(() => {
    const node = textarea.current;
    const field = node?.parentElement;
    if (!node || !field) return;
    const resize = () => {
      node.style.height = "30px";
      node.style.height = expanded
        ? `${Math.min(152, window.innerHeight * 0.25, Math.max(32, node.scrollHeight))}px`
        : "30px";
    };
    resize();
    let width = field.clientWidth;
    const observer = new ResizeObserver(() => {
      if (width === field.clientWidth) return;
      width = field.clientWidth;
      resize();
    });
    observer.observe(field);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [draft, expanded]);
  function commit(): Promise<boolean> {
    if (pending.current) return pending.current;
    if (!isCurrent()) return Promise.resolve(false);
    const next = draftRef.current;
    if (next === committed.current || readOnly) return Promise.resolve(true);
    const operation = (async () => {
      try {
        await onCommit(next);
        committed.current = next;
        if (mounted.current && isCurrent()) setError("");
        return true;
      } catch (error) {
        if (mounted.current && isCurrent())
          setError(error instanceof Error ? error.message : String(error));
        return false;
      } finally {
        pending.current = null;
      }
    })();
    pending.current = operation;
    return operation;
  }
  useLayoutEffect(() => {
    onCommitReady?.(commit, () => !readOnly && draftRef.current !== committed.current);
    return () => onCommitReady?.(null);
  });
  return (
    <div
      className={`value-bar ${readOnly ? "value-bar-readonly" : "value-bar-editable"} ${expanded ? "value-bar-expanded" : ""}`}
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        void commit().then(ok => {
          if (!ok && mounted.current && isCurrent()) textarea.current?.focus();
        });
      }}
    >
      {address && <output aria-label="Cell address">{address}</output>}
      <label className="sr-only" htmlFor="cell-value">{caption ?? (readOnly ? "Preview" : "Value")}</label>
      <div className="value-bar-field">
      <textarea
        ref={textarea}
        id="cell-value"
        aria-label="Selected cell value"
        title={
          previewOnly
            ? "Preview only. Open the nested table or Source for the complete value."
            : readOnly
              ? "Read-only value. Open its table or Source to edit."
              : "Click here to edit. Enter to apply; Shift+Enter for a new line; Escape to cancel."
        }
        placeholder={readOnly ? "Empty value" : "Type a value…"}
        aria-describedby="value-bar-help"
        rows={1}
        wrap={expanded ? "soft" : "off"}
        value={draft}
        readOnly={readOnly}
        aria-invalid={!!error}
        onChange={(e) => {
          draftRef.current = e.target.value;
          setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            draftRef.current = value;
            setDraft(value);
            setError("");
          }
        }}
      />
      <button type="button" className="value-bar-expand"
        title={expanded ? "Collapse value bar" : "Expand value bar"}
        aria-label={expanded ? "Collapse value bar" : "Expand value bar"}
        aria-expanded={expanded} aria-controls="cell-value"
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => setExpanded(!expanded)}>
        <ColumnMenuChevron />
      </button>
      </div>
      {onOpenTable && <button type="button" className="value-bar-open"
        title="Open as table (Ctrl-click or ⌘-click the cell)"
        aria-label="Open selected value as table" onClick={() => { void commit().then(ok => { if (ok) onOpenTable(); }); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18M9 10v10M3 15h18" />
        </svg>
      </button>}
      <span id="value-bar-help" className="sr-only">
        {readOnly
          ? "Read-only preview."
          : "Edit the selected cell here. Enter applies the change; Escape cancels."}
      </span>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}

/** Keep the bar stable; identifier selections still show their address and key. */
export function ValueBarPlaceholder({
  address,
  value,
}: {
  address?: string;
  value?: string;
}) {
  const selected = value !== undefined;
  return (
    <div
      className="value-bar value-bar-empty"
      aria-hidden={!selected || undefined}
    >
      {selected && address ? (
        <output aria-label="Cell address">{address}</output>
      ) : (
        <span className="value-bar-address value-bar-address-idle" />
      )}
      <span className="value-bar-caption sr-only">{selected ? "Key" : "Value"}</span>
      <span
        className="value-bar-empty-field"
        aria-label={selected ? "Selected key" : undefined}
        title={
          selected
            ? "Double-click the key in the table to rename it."
            : undefined
        }
      >
        {selected ? value : "Select a cell"}
      </span>
    </div>
  );
}
