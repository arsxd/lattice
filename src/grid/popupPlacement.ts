export type Placement = {
  left: number;
  /** Set when the menu opens downward from the pointer. */
  top?: number;
  /** Set when the menu opens upward: distance from the window bottom. */
  bottom?: number;
  /** The menu scrolls beyond this height. */
  maxHeight: number;
};

/**
 * Where a context menu goes. It opens at the pointer; downward when it fits,
 * upward from the pointer when it fits there, otherwise on the roomier side
 * with a height limit so it scrolls instead of leaving the window. The result
 * is decided once, so later changes in content cannot make it jump.
 */
export function placeAtPoint(
  point: { x: number; y: number },
  size: { width: number; height: number },
  view: { width: number; height: number },
  margin = 8,
): Placement {
  const left = Math.max(
    margin,
    Math.min(point.x, view.width - size.width - margin),
  );
  // A pointer inside the margin is treated as sitting on the margin line, so
  // the menu itself always starts inside the window.
  const y = Math.max(margin, Math.min(point.y, view.height - margin));
  const below = view.height - y - margin;
  const above = y - margin;
  if (size.height <= below || (size.height > above && below >= above))
    return { left, top: y, maxHeight: below };
  return { left, bottom: view.height - y, maxHeight: above };
}
