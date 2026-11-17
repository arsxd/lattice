import { expect, it } from "vitest";
import { groupedHeaderRows } from "../src/grid/groupedHeaders";
import { orderFieldPaths } from "../src/document/columnPaths";
import { DocumentEngine, compareNumbers } from "../src/document/engine";
import { expandedRows } from "../src/document/editableGroups";
it("merges the details header while ordinary headers span both rows", () => {
  const rows = groupedHeaderRows([
    ["title"],
    ["details", "pages"],
    ["details", "language"],
    ["details", "note"],
  ]);
  expect(rows[0]).toEqual([
    { label: "title", column: 0, colSpan: 1, rowSpan: 2, leaf: true },
    { label: "details", column: 1, colSpan: 3, rowSpan: 1, leaf: false },
  ]);
  expect(rows[1].map((cell) => cell.label)).toEqual([
    "pages",
    "language",
    "note",
  ]);
});
it("keeps late sibling fields contiguous and literal slash keys intact", () => {
  const paths = orderFieldPaths([
    ["details", "pages"],
    ["price"],
    ["details", "note"],
    ["literal/slash"],
  ]);
  expect(paths).toEqual([
    ["details", "pages"],
    ["details", "note"],
    ["price"],
    ["literal/slash"],
  ]);
  expect(groupedHeaderRows(paths)[0].at(-1)?.label).toBe("literal/slash");
});
it("expands nested object fields in array records and retains numeric paths", () => {
  const e = new DocumentEngine(
    '[{"id":"b","shipping":{"method":"Standard","gift":true}},{"id":"a","shipping":{"method":"Express","gift":false}}]',
  );
  const s = e.expanded([]).sections[0];
  expect(s.columnPaths).toEqual([
    ["id"],
    ["shipping", "method"],
    ["shipping", "gift"],
  ]);
  expect(s.groups[0].children[1][1].cell.path).toEqual([
    1,
    "shipping",
    "method",
  ]);
  const rows = expandedRows(
    s,
    "",
    { column: 0, direction: "ASC" },
    {},
    compareNumbers,
  );
  expect(rows.map((r) => r.cells[0].value)).toEqual(["a", "b"]);
  expect(rows[0].count).toBe(1);
  expect(
    e.expanded([], {
      path: [],
      records: true,
      showIndex: false,
      search: "",
      page: 0,
      sort: { column: 0, direction: "ASC" },
    }).sections[0].groups[0].children[0][0].value,
  ).toBe("a");
});
it("does not fabricate a blank row when an inherited array filter matches nothing", () => {
  const e = new DocumentEngine('[{"n":1,"nested":{"x":true}}]');
  const s = e.expanded([], {
    path: [],
    records: true,
    showIndex: false,
    search: "does-not-match",
    page: 0,
  }).sections[0];
  expect(s.groups).toHaveLength(0);
});
