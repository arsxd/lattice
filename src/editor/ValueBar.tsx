import { useEffect, useState } from "react";
export function ValueBar({
  address,
  value,
  editable,
  previewOnly = false,
  onCommit,
}: {
  address: string;
  value: string;
  editable: boolean;
  previewOnly?: boolean;
  onCommit: (v: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value),
    [error, setError] = useState("");
  useEffect(() => {
    setDraft(value);
    setError("");
  }, [value, address]);
  async function commit() {
    if (draft === value || !editable) return;
    try {
      await onCommit(draft);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <div className="value-bar">
      <output aria-label="Cell address">{address || "—"}</output>
      <label htmlFor="cell-value">Value</label>
      <input
        id="cell-value"
        aria-label="Selected cell value"
        title={
          previewOnly
            ? "Preview only. Open the nested table or Source for the complete value."
            : undefined
        }
        value={draft}
        readOnly={!editable}
        aria-invalid={!!error}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          }
          if (e.key === "Escape") {
            setDraft(value);
            setError("");
          }
        }}
      />
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
