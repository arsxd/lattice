import { TableIcon } from "./SheetIcons";
import { useLayoutEffect, useRef, useState, type HTMLAttributes } from "react";

/** Follow the actual cell size, including manual row and column resizing. */
export function CellPreview({
  onOpenTable,
  title,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { onOpenTable?: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [clipped, setClipped] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const content = text.current;
      if (!content) return;
      setClipped(
        node.scrollHeight > node.clientHeight + 1 ||
          content.scrollWidth > content.clientWidth + 1,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [props.children]);
  return (
    <span
      {...props}
      ref={ref}
      title={onOpenTable ? undefined : title}
      data-clipped={clipped || undefined}
    >
      <span
        ref={text}
        className="cell-preview-text"
        title={onOpenTable ? title : undefined}
      >
        {props.children}
      </span>
      {onOpenTable && (
        <button
          type="button"
          className="cell-open-table"
          tabIndex={-1}
          aria-label="Open as table"
          title="Open as table"
          onPointerDown={(event) => event.preventDefault()}
          onDoubleClick={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onOpenTable();
          }}
        >
          <TableIcon />
        </button>
      )}
    </span>
  );
}
