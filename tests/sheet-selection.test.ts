import { expect, it } from "vitest";
import {
  selectCell,
  selectHeader,
  selectedCellCount,
  selectionContains,
} from "../src/document/sheetSelection";
import { DocumentEngine } from "../src/document/engine";
import {
  copySelection,
  pasteSelection,
} from "../src/document/selectionOperations";
const q = { path: [], records: true, search: "", page: 0 };
it("selects full filtered columns across pages without materializing unselected rows", () => {
  const engine = new DocumentEngine(
    JSON.stringify(
      Array.from({ length: 620 }, (_, id) => ({
        id,
        group: id % 2 ? "odd" : "even",
      })),
    ),
  );
  const query = { ...q, search: "even", page: 0 };
  const view = engine.project(query);
  const selection = selectHeader(null, "columns", { r: 0, c: 1 });
  expect(selectedCellCount(selection, view.matched, view.headers.length)).toBe(
    310,
  );
  expect(
    selectionContains(
      selection,
      { r: 309, c: 1 },
      view.matched,
      view.headers.length,
    ),
  ).toBe(true);
  expect(
    copySelection(engine, query, selection, view.revision).split("\r\n"),
  ).toHaveLength(310);
  const all = selectHeader(null, "columns", { r: 500, c: 1 });
  expect(
    copySelection(engine, { ...q, page: 1 }, all, view.revision).split("\r\n"),
  ).toHaveLength(620);
});
it("supports shift and additive row/column selection with a distinct active cell", () => {
  let selection = selectHeader(null, "rows", { r: 3, c: 0 });
  selection = selectHeader(selection, "rows", { r: 5, c: 0 }, { extend: true });
  selection = selectHeader(
    selection,
    "rows",
    { r: 8, c: 0 },
    { additive: true },
  );
  expect(selectedCellCount(selection, 10, 4)).toBe(16);
  expect(selectionContains(selection, { r: 6, c: 1 }, 10, 4)).toBe(false);
  selection = selectHeader(
    selection,
    "rows",
    { r: 4, c: 0 },
    { additive: true },
  );
  expect(selectedCellCount(selection, 10, 4)).toBe(12);
  const cell = selectCell(selection, { r: 1, c: 2 });
  expect(selectedCellCount(cell, 10, 4)).toBe(1);
});
it("pastes across a page boundary atomically and preserves arbitrary numeric tokens", () => {
  const engine = new DocumentEngine(
    JSON.stringify(Array.from({ length: 503 }, (_, id) => ({ value: id }))),
  );
  const selection = selectCell(null, { r: 499, c: 1 });
  pasteSelection(engine, q, selection, "9007199254740993\r\n1e400", 0);
  expect(engine.raw([499, "value"])).toBe("9007199254740993");
  expect(engine.raw([500, "value"])).toBe("1e400");
  engine.undo();
  expect(engine.raw([499, "value"])).toBe("499");
});
it("rejects stale, oversized and ambiguous multi-area operations without changing data", () => {
  const engine = new DocumentEngine('[{"v":1},{"v":2},{"v":3}]');
  let selection = selectHeader(null, "rows", { r: 0, c: 0 });
  selection = selectHeader(
    selection,
    "rows",
    { r: 2, c: 0 },
    { additive: true },
  );
  expect(() => pasteSelection(engine, q, selection, "7", 0)).toThrow(
    "nonadjacent",
  );
  expect(() =>
    copySelection(engine, q, selectCell(null, { r: 0, c: 1 }), 5),
  ).toThrow("changed");
  expect(engine.text).toBe('[{"v":1},{"v":2},{"v":3}]');
});
it("rejects an oversized full column without copying a partial page", () => {
  const engine = new DocumentEngine(
    JSON.stringify(Array.from({ length: 10001 }, (_, n) => ({ v: n }))),
  );
  const selection = selectHeader(null, "columns", { r: 0, c: 1 });
  expect(selectedCellCount(selection, 10001, 2)).toBe(10001);
  expect(() => copySelection(engine, q, selection, 0)).toThrow("10,000");
});
it("keeps whole-table selection distinct from an individual cell", async () => {
  const { selectWholeTable } = await import("../src/document/sheetSelection");
  expect(selectWholeTable(1, 1)).toMatchObject({
    mode: "columns",
    spans: [[0, 0]],
  });
  expect(selectWholeTable(0, 2)).toBeNull();
  expect(selectWholeTable(620, 3, 500)?.anchor).toEqual({ r: 500, c: 0 });
});
