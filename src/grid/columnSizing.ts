import type { Projection } from "../document/engine";

/** Automatic defaults only; callers retain explicit user width overrides. */
export function contentColumnWidths(
  projection: Pick<Projection, "headers" | "columnKinds" | "rows">,
  viewportWidth: number,
  measureText: (text: string) => number,
): number[] {
  const count = projection.headers.length;
  if (!count) return [];
  const available = Math.max(0, Math.floor(viewportWidth) - 44);
  if (count === 1) return [available];
  const cap = count > 6 ? 220 : 280;
  const widths = projection.headers.map((header, index) => {
    if (projection.columnKinds[index] === "index") return 88;
    let width = Math.max(88, measureText(header.slice(0, 240)) * 1.1 + 52);
    for (const row of projection.rows.slice(0, 50)) {
      width = Math.max(
        width,
        measureText((row.cells[index]?.display ?? "").slice(0, 240)) + 24,
      );
    }
    return Math.ceil(Math.min(cap, width));
  });
  if (count === 2) {
    if (projection.columnKinds[0] === "index")
      return [88, Math.max(0, available - 88)];
    const key = Math.min(widths[0], Math.floor(available * 0.45));
    return [key, available - key];
  }
  return widths;
}
