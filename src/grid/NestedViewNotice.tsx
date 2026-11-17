import { useEffect, useId, useRef, useState } from "react";

/** Explain automatic fallback without reserving a permanent toolbar row. */
export function NestedViewNotice({ reason }: { reason: string }) {
  const [open, setOpen] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!root.current?.matches(":hover") && !root.current?.contains(document.activeElement))
        setOpen(false);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="nested-view-notice" ref={root}>
      <button type="button" className="nested-notice-button" aria-label="Why nested data is unavailable" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)} title="Showing regular table">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6m0 3v1" />
        </svg>
      </button>
      {open && <div id={id} className="nested-warning" role="status"><strong>Showing regular table.</strong> {reason}</div>}
    </div>
  );
}
