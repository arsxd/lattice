import { useRef } from "react";
export const clampRowHeight = (height: number) =>
  Math.max(28, Math.min(400, Math.round(height)));
export function RowHeightHandle({
  number,
  height,
  onChange,
  onReset,
}: {
  number: number;
  height: number;
  onChange: (height: number) => void;
  onReset: () => void;
}) {
  const drag = useRef<{ y: number; height: number } | null>(null);
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
          onChange(
            clampRowHeight(drag.current.height + e.clientY - drag.current.y),
          );
        }
      }}
      onPointerUp={(e) => {
        drag.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
        e.stopPropagation();
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          onChange(clampRowHeight(height + (e.key === "ArrowUp" ? -8 : 8)));
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
