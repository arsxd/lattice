import { useRef } from "react";

export function ColumnGroupResizeHandle({
  widthBeforeDivider,
  columnsBeforeDivider,
  onResize,
  onAutoFit,
}: {
  widthBeforeDivider: () => number;
  columnsBeforeDivider: number;
  onResize: (width: number) => void;
  onAutoFit: () => void;
}) {
  const drag = useRef<{ x: number; width: number; applied?: number } | null>(
    null,
  );
  return (
    <span
      className="column-group-resizer"
      aria-hidden="true"
      title="Drag to resize the selected columns"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, width: widthBeforeDivider() };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start) return;
        // Resizing earlier selected columns also moves this divider.
        const width = Math.max(
          80,
          Math.round(
            (start.width + event.clientX - start.x) / columnsBeforeDivider,
          ),
        );
        if (width !== start.applied) {
          start.applied = width;
          onResize(width);
        }
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onAutoFit();
      }}
    />
  );
}
