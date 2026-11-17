import type { Projection, Row } from "../document/engine";

/** Automatic defaults only; callers retain explicit user width overrides. */
export function contentColumnWidths(
  projection: Pick<Projection, "headers" | "columnKinds"> & {
    rows: Pick<Row, "cells">[];
  },
  viewportWidth: number,
  measureText: (text: string) => number,
): number[] {
  const count = projection.headers.length;
  if (!count) return [];
  const cap = Math.min(
    count > 6 ? 220 : 280,
    Math.max(88, Math.floor(viewportWidth) - 44),
  );
  const widths = projection.headers.map((header, index) => {
    if (projection.columnKinds[index] === "index") return 88;
    let width = Math.max(88, measureText(header.slice(0, 240)) * 1.1 + 52);
    for (const row of projection.rows.slice(0, 50)) {
      const cell = row.cells[index];
      const text = (cell?.display ?? "").slice(0, 240);
      // Numeric cells use tabular digits; zero gives their digit advance.
      const measured =
        cell?.type === "number" ? text.replace(/\d/g, "0") : text;
      width = Math.max(width, measureText(measured) + 24);
    }
    return Math.ceil(Math.min(cap, width));
  });
  return widths;
}

export function createTextMeasurer() {
  const context = document.createElement("canvas").getContext("2d");
  if (context)
    context.font =
      '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  return (text: string) => context?.measureText(text).width ?? text.length * 7;
}
