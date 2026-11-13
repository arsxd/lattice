import type { SheetSelection } from "../document/sheetSelection";

/** Frozen panes are prefixes, including unselected gaps between header ranges. */
export function freezeSelectionTarget(
  selection: SheetSelection | null,
  pageOffset: number,
  pageRowCount: number,
): { axis: "rows" | "columns"; count: number } | null {
  if (!selection || selection.mode === "cells" || !selection.spans.length)
    return null;
  let last = -1;
  for (const [start, end] of selection.spans) {
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end < start
    )
      return null;
    if (
      selection.mode === "rows" &&
      (start < pageOffset || end >= pageOffset + pageRowCount)
    )
      return null;
    last = Math.max(last, end);
  }
  return {
    axis: selection.mode,
    count: last + 1 - (selection.mode === "rows" ? pageOffset : 0),
  };
}
