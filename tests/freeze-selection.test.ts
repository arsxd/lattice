import { expect, it } from "vitest";
import type { SheetSelection, Span } from "../src/document/sheetSelection";
import { freezeSelectionTarget } from "../src/grid/freezeSelection";
const selection = (
  mode: SheetSelection["mode"],
  spans: Span[],
): SheetSelection => ({
  mode,
  spans,
  anchor: { r: 0, c: 0 },
  end: { r: 0, c: 0 },
});
it("includes the last selected row and column", () => {
  expect(freezeSelectionTarget(selection("rows", [[2, 4]]), 0, 20)).toEqual({
    axis: "rows",
    count: 5,
  });
  expect(freezeSelectionTarget(selection("columns", [[2, 4]]), 0, 20)).toEqual({
    axis: "columns",
    count: 5,
  });
});
it("maps global row indices into the current page", () => {
  expect(
    freezeSelectionTarget(selection("rows", [[503, 506]]), 500, 20),
  ).toEqual({ axis: "rows", count: 7 });
});
it("freezes the entire prefix for disjoint selections", () => {
  expect(
    freezeSelectionTarget(
      selection("rows", [
        [1, 1],
        [4, 4],
      ]),
      0,
      20,
    ),
  ).toEqual({ axis: "rows", count: 5 });
});
it("rejects ranges that extend beyond either boundary of this page", () => {
  expect(
    freezeSelectionTarget(selection("rows", [[499, 503]]), 500, 20),
  ).toBeNull();
  expect(
    freezeSelectionTarget(selection("rows", [[503, 520]]), 500, 20),
  ).toBeNull();
});
it("offers no header freeze target for cells or empty selections", () => {
  expect(freezeSelectionTarget(selection("cells", []), 0, 20)).toBeNull();
  expect(freezeSelectionTarget(selection("rows", []), 0, 20)).toBeNull();
  expect(freezeSelectionTarget(null, 0, 20)).toBeNull();
});
