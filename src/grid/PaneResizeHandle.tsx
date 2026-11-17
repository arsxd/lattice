import { useEffect, useLayoutEffect, useRef, useState } from "react";
export const clampPaneWidth = (width: number, details = false) =>
  Math.round(
    Math.max(
      180,
      Math.min(
        details ? Infinity : 520,
        width,
        typeof window === "undefined"
          ? 520
          : window.innerWidth * (details ? 0.5 : 0.42),
      ),
    ),
  );
export function usePaneWidth(name: string, initial: number) {
  const key = `lattice-pane-${name}`;
  const [width, setWidth] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(key));
      return clampPaneWidth(
        stored >= 180 ? stored : initial,
        name === "details",
      );
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    const resize = () =>
      setWidth((value) => clampPaneWidth(value, name === "details"));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [name]);
  return [
    width,
    (next: number) => {
      const value = clampPaneWidth(next, name === "details");
      setWidth(value);
      try {
        localStorage.setItem(key, String(value));
      } catch {
        /* Layout remains usable when storage is blocked. */
      }
    },
  ] as const;
}
export function PaneResizeHandle({
  label,
  width,
  reverse = false,
  onChange,
  onReset,
}: {
  label: string;
  width: number;
  reverse?: boolean;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  const start = useRef<{ x: number; width: number } | null>(null);
  const handle = useRef<HTMLDivElement>(null);
  const [actualWidth, setActualWidth] = useState(width);
  useLayoutEffect(() => {
    const element = reverse
      ? handle.current?.parentElement
      : handle.current?.previousElementSibling;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setActualWidth(Math.round(element.getBoundingClientRect().width)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [reverse]);
  return (
    <div
      ref={handle}
      className={`pane-resizer ${reverse ? "pane-resizer-right" : ""}`}
      role="separator"
      aria-label={`Resize ${label} pane`}
      aria-orientation="vertical"
      aria-valuenow={actualWidth}
      aria-valuemin={180}
      aria-valuemax={clampPaneWidth(Infinity, reverse)}
      tabIndex={0}
      title="Drag to resize. Arrow keys adjust width; double-click or Home resets."
      onDoubleClick={onReset}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, width: actualWidth };
      }}
      onPointerMove={(e) => {
        if (start.current)
          onChange(
            clampPaneWidth(
              start.current.width +
                (e.clientX - start.current.x) * (reverse ? -1 : 1),
              reverse,
            ),
          );
      }}
      onPointerUp={(e) => {
        start.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
      onLostPointerCapture={() => {
        start.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key === "Home") {
          e.preventDefault();
          onReset();
        } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          onChange(
            clampPaneWidth(
              actualWidth +
                (e.key === "ArrowLeft" ? -12 : 12) * (reverse ? -1 : 1),
              reverse,
            ),
          );
        }
      }}
    />
  );
}
