import { useEffect, useRef } from "react";
export function FreezeMenu({
  rows,
  columns,
  selection,
  disabled,
  paused,
  onChange,
}: {
  rows: number;
  columns: number;
  selection: { row: number; column: number } | null;
  disabled: boolean;
  paused?: string;
  onChange: (value: { rows: number; columns: number }) => void;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node))
        root.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && root.current?.open) {
        root.current.open = false;
        root.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  function change(value: { rows: number; columns: number }) {
    onChange(value);
    if (root.current) root.current.open = false;
  }
  return (
    <details className="freeze-menu" ref={root}>
      <summary
        title={paused ?? "Keep rows and columns visible while scrolling"}
      >
        {paused ? "Freeze paused" : rows || columns ? "Frozen panes" : "Freeze"}
      </summary>
      <div className="freeze-options">
        {(rows > 0 || columns > 0) && (
          <p>
            {rows} rows · {columns} columns frozen{paused ? " (paused)" : ""}
          </p>
        )}
        {paused && <p>{paused}</p>}
        <button
          disabled={disabled}
          onClick={() => change({ rows: 1, columns })}
        >
          Freeze first row
        </button>
        <button
          disabled={disabled}
          onClick={() => change({ rows, columns: 1 })}
        >
          Freeze first column
        </button>
        <button
          disabled={
            disabled || !selection || (!selection.row && !selection.column)
          }
          onClick={() => {
            if (selection)
              change({ rows: selection.row, columns: selection.column });
          }}
        >
          Freeze above and left of selection
        </button>
        <button
          disabled={disabled || (!rows && !columns)}
          onClick={() => change({ rows: 0, columns: 0 })}
        >
          Unfreeze panes
        </button>
      </div>
    </details>
  );
}
