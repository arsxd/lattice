import { expect, it } from "vitest";
import { DocumentEngine, type Query } from "../src/document/engine";
import {
  copySelection,
  pasteSelection,
  fillSelection,
} from "../src/document/selectionOperations";
import { selectCell, selectWholeTable } from "../src/document/sheetSelection";
const query: Query = {
  path: [],
  records: true,
  search: "",
  page: 0,
  showIndex: false,
};
it("hides only generated array indices, retaining actual index/id fields and paths", () => {
  const engine = new DocumentEngine(
    '[{"index":91,"id":"a"},{"index":92,"id":"b"}]',
  );
  const p = engine.project(query);
  expect(p.headers).toEqual(["index", "id"]);
  expect(p.columnKinds).toEqual(["field", "field"]);
  expect(p.rows[1].cells[0].path).toEqual([1, "index"]);
  expect(engine.project({ ...query, showIndex: true }).headers).toEqual([
    "Index",
    "index",
    "id",
  ]);
});
it("sorts, filters, copies and pastes the first visible field using its real JSON path", () => {
  const engine = new DocumentEngine(
    '[{"name":"Zulu","n":2},{"name":"Alpha","n":1}]',
  );
  const q = { ...query, sort: { column: 0, direction: "ASC" as const } };
  expect(engine.project(q).rows[0].path).toEqual([1]);
  const selected = selectCell(null, { r: 0, c: 0 });
  expect(copySelection(engine, q, selected, engine.revision)).toBe("Alpha");
  pasteSelection(engine, q, selected, "Changed", engine.revision);
  expect(engine.raw([1, "name"])).toBe('"Changed"');
  expect(engine.raw([0, "name"])).toBe('"Zulu"');
  const choices = engine.project({ ...query, optionsColumn: 0 }).filterOptions!;
  const key = choices.find((option) => option.label === "Changed")!.key;
  expect(
    engine.project({ ...query, valueFilters: { "0": [key] } }).rows[0].path,
  ).toEqual([1]);
});
it("keeps exact primitive values in copy/fill when the index is hidden", () => {
  const engine = new DocumentEngine("[9007199254740993,0]");
  expect(engine.project(query).headers).toEqual(["Value"]);
  expect(
    copySelection(engine, query, selectWholeTable(2, 1), engine.revision),
  ).toBe("9007199254740993\r\n0");
  fillSelection(
    engine,
    query,
    selectCell(selectCell(null, { r: 0, c: 0 }), { r: 1, c: 0 }, true),
    engine.revision,
  );
  expect(engine.text).toBe("[9007199254740993,9007199254740993]");
});
it("retains object mapping keys and correctly sorts visible original indices numerically", () => {
  const engine = new DocumentEngine(
    '{"first":{"name":"a"},"second":{"name":"b"}}',
  );
  expect(engine.project(query).columnKinds).toEqual(["key", "field"]);
  const array = new DocumentEngine(
    JSON.stringify(Array.from({ length: 13 }, (_, i) => ({ n: i }))),
  );
  expect(
    array
      .project({
        ...query,
        showIndex: true,
        sort: { column: 0, direction: "DESC" },
      })
      .rows.slice(0, 3)
      .map((row) => row.path),
  ).toEqual([[12], [11], [10]]);
});
