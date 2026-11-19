import { useLayoutEffect, useRef, useState, type HTMLAttributes } from "react";

/** Follow the actual cell size, including manual row and column resizing. */
export function CellPreview(props: HTMLAttributes<HTMLSpanElement>) {
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
    <span {...props} ref={ref} data-clipped={clipped || undefined}>
      <span ref={text} className="cell-preview-text">
        {props.children}
      </span>
    </span>
  );
}
