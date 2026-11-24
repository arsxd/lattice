import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The reason an in-cell edit was rejected, shown right under the cell. It is a
 * portal because grid cells clip their contents; the cell's box is read once
 * per render, so it follows the editor if the grid scrolls or resizes it.
 */
export function InlineError({
  anchor,
  children,
}: {
  anchor: HTMLElement | null;
  children: string;
}) {
  const [box, setBox] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    const cell = anchor?.closest<HTMLElement>('[role="gridcell"]') ?? anchor;
    if (!cell) return;
    const measure = () => setBox(cell.getBoundingClientRect());
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(cell);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [anchor, children]);
  if (!box) return null;
  const below = box.bottom + 4 + 36 <= window.innerHeight;
  return createPortal(
    <div
      role="alert"
      id="cell-error"
      className="inline-error"
      style={{
        left: Math.max(8, Math.min(box.left, window.innerWidth - 328)),
        top: below ? box.bottom + 4 : undefined,
        bottom: below ? undefined : window.innerHeight - box.top + 4,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
