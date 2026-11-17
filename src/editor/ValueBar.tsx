import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = {
  address: string;
  value: string;
  editable: boolean;
  previewOnly?: boolean;
  onCommit: (v: string) => Promise<void>;
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
  value,
  editable,
  previewOnly = false,
  onCommit,
  isCurrent,
}: Props & { isCurrent: () => boolean }) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(true);
  const pending = useRef<string | null>(null);
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
    if (!node) return;
    const resize = () => {
      node.style.height = "0px";
      node.style.height = `${Math.min(74, Math.max(32, node.scrollHeight + 2))}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [draft]);
  async function commit() {
    const next = draftRef.current;
    if (
      next === committed.current ||
      pending.current !== null ||
      readOnly ||
      !isCurrent()
    )
      return;
    pending.current = next;
    try {
      await onCommit(next);
      committed.current = next;
      if (mounted.current && isCurrent()) setError("");
    } catch (e) {
      if (mounted.current && isCurrent()) setError(String(e));
    } finally {
      pending.current = null;
    }
  }
  return (
    <div
      className={`value-bar ${readOnly ? "value-bar-readonly" : "value-bar-editable"}`}
    >
      {address && <output aria-label="Cell address">{address}</output>}
      <label htmlFor="cell-value">{readOnly ? "Preview" : "Edit value"}</label>
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
        value={draft}
        readOnly={readOnly}
        aria-invalid={!!error}
        onChange={(e) => {
          draftRef.current = e.target.value;
          setDraft(e.target.value);
        }}
        onBlur={() => void commit()}
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
      <span id="value-bar-help" className="sr-only">
        {readOnly
          ? "Read-only preview."
          : "Edit the selected cell here. Enter applies the change; Escape cancels."}
      </span>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
