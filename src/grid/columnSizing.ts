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
  if (
    count === 2 &&
    (projection.columnKinds[0] === "key" ||
      projection.columnKinds[0] === "index") &&
    (projection.columnKinds[1] === "value" ||
      projection.columnKinds[1] === "mixed")
  ) {
    // Use spare space only as far as the visible sample needs; do not stretch
    // short values across the entire window or override manually sized columns.
    const available = Math.max(
      88,
      Math.floor(viewportWidth) - 44 - widths[0] - 2,
    );
    let desired = widths[1];
    for (const row of projection.rows.slice(0, 50)) {
      const cell = row.cells[1];
      const value = (cell?.display ?? "").slice(0, 4096);
      const text = cell?.type === "number" ? value.replace(/\d/g, "0") : value;
      for (const line of text.split(/\r\n|\r|\n/))
        desired = Math.max(desired, measureText(line) + 24);
    }
    widths[1] = Math.ceil(Math.max(widths[1], Math.min(available, desired)));
  }
  return widths;
}

export function createTextMeasurer() {
  const context = document.createElement("canvas").getContext("2d");
  if (context)
    context.font =
      '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  return (text: string) => context?.measureText(text).width ?? text.length * 7;
}
