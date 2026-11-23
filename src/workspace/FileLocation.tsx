import { useEffect, useRef } from "react";

export function FileLocation({ name, linked, onNotice }: {
  name: string; linked: boolean; onNotice: (message: string) => void;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  const clearMenuSelection = () => {
    const selection = window.getSelection();
    if (root.current && selection &&
      ((selection.anchorNode && root.current.contains(selection.anchorNode)) ||
       (selection.focusNode && root.current.contains(selection.focusNode))))
      selection.removeAllRanges();
  };
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (root.current && event.target instanceof Node && !root.current.contains(event.target)) {
        clearMenuSelection();
        root.current.open = false;
        if (document.activeElement instanceof HTMLElement && root.current.contains(document.activeElement))
          document.activeElement.blur();
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && root.current?.open) {
        clearMenuSelection();
        root.current.open = false;
        root.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);
  useEffect(() => { if (root.current) root.current.open = false; }, [name]);
  return <details className="file-location" ref={root} onToggle={() => { if (!root.current?.open) clearMenuSelection(); }}>
    <summary className="document-filename" title="File information and copy filename"
      onPointerDown={clearMenuSelection}
      onContextMenu={event => { event.preventDefault(); clearMenuSelection(); if (root.current) root.current.open = true; }}>
      {name}
    </summary>
    <section className="file-location-panel" aria-label="File information">
      <strong>{name}</strong>
      <p>{linked ? "Linked local file. " : ""}Full folder paths aren’t available to web apps.</p>
      <button type="button" onClick={() => {
        if (!navigator.clipboard?.writeText) { onNotice("Clipboard access is unavailable. Select and copy the filename above."); return; }
        void navigator.clipboard.writeText(name).then(() => {
          if (root.current) root.current.open = false;
          onNotice("Filename copied.");
        }, () => onNotice("Could not copy the filename. Select and copy it above."));
      }}>Copy filename</button>
    </section>
  </details>;
}
