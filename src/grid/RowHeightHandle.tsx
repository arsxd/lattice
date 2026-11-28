import { useRef } from "react";
export const clampRowHeight = (height: number) =>
  Math.max(28, Math.min(400, Math.round(height)));
export function RowHeightHandle({
  number,
  height,
  onChange,
  onCommit,
  onReset,
}: {
  number: number;
  height: number;
  onChange: (height: number) => void;
  onCommit: (height: number) => void;
  onReset: () => void;
}) {
  const drag = useRef<{ y: number; height: number; size?: number } | null>(
    null,
  );
  return (
    <span
      className="row-height-handle"
      data-row-resizer
      role="separator"
      aria-orientation="horizontal"
      aria-label={`Resize row ${number}`}
      aria-valuemin={28}
      aria-valuemax={400}
      aria-valuenow={height}
      tabIndex={-1}
      title="Drag to resize row. Double-click to reset."
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onReset();
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.focus();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { y: e.clientY, height };
      }}
      onPointerMove={(e) => {
        if (drag.current) {
          e.stopPropagation();
          drag.current.size = clampRowHeight(
            drag.current.height + e.clientY - drag.current.y,
          );
          onChange(drag.current.size);
        }
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
        e.stopPropagation();
      }}
      onLostPointerCapture={() => {
        const size = drag.current?.size;
        drag.current = null;
        if (size !== undefined) onCommit(size);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          onCommit(clampRowHeight(height + (e.key === "ArrowUp" ? -8 : 8)));
        }
        if (e.key === "Home") {
          e.preventDefault();
          e.stopPropagation();
          onReset();
        }
      }}
    />
  );
}
