import { useEffect, useId, useRef, useState } from "react";

/** Explain automatic fallback without reserving a permanent toolbar row. */
export function NestedViewNotice({ reason }: { reason: string }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) { setOpen(false); setPinned(false); }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); setPinned(false); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="nested-view-notice" ref={root}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { if (!pinned) setOpen(false); }}
      onFocus={() => setOpen(true)}
      onBlur={(event) => { if (!pinned && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    >
      <button type="button" className="nested-notice-button" aria-label="Why nested data is unavailable" aria-expanded={open} aria-controls={open ? id : undefined} aria-describedby={open ? id : undefined} onClick={() => { setPinned(!pinned); setOpen(!pinned); }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10v7m0-10v1" />
        </svg>
      </button>
      {open && <div id={id} className="nested-warning" role="status"><span className="nested-warning-title">Showing regular table</span><span>{reason}</span></div>}
    </div>
  );
}
