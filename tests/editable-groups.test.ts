import { expect, it } from "vitest";
import { DocumentEngine, compareNumbers } from "../src/document/engine";
import {
  expandedRows,
  nextExpandedCell,
  uniqueGroupEdits,
} from "../src/document/editableGroups";
const text =
  '[{"name":"B","items":[{"n":9007199254740993},{"n":2}],"other":[{"x":true}]},{"name":"A","items":[{"n":1}],"other":[]}]';
it("automatically expands sibling arrays separately and preserves exact values and identities", () => {
  const d = new DocumentEngine(text).expanded([]);
  expect(d.sections.map((s) => s.key)).toEqual(["items", "other"]);
  expect(d.sections[0].groups[0].children[0][0].value).toBe("9007199254740993");
  expect(d.sections[0].groups[0].children[0][0].cell.path).toEqual([
    0,
    "items",
    0,
    "n",
  ]);
});
it("edits a parent once, atomically rejects conflicting merged values and preserves undo", () => {
  const e = new DocumentEngine(text),
    s = e.expanded([]).sections[0];
  const parent = s.groups[0].parent[0].cell;
  const commands = uniqueGroupEdits([
    { cell: parent, raw: '"C"' },
    { cell: parent, raw: '"C"' },
    { cell: s.groups[0].children[1][0].cell, raw: "3" },
  ]);
  expect(commands).toHaveLength(2);
  e.mutate({ action: "batch", commands }, 0);
  expect(e.raw([0, "name"])).toBe('"C"');
  expect(e.raw([0, "items", 0, "n"])).toBe("9007199254740993");
  e.undo();
  expect(e.text).toBe(text);
  expect(() =>
    uniqueGroupEdits([
      { cell: parent, raw: '"a"' },
      { cell: parent, raw: '"b"' },
    ]),
  ).toThrow(/different values/);
  expect(e.text).toBe(text);
});
it("sorts parents as groups and children within parents, retaining associations when filtered", () => {
  const s = new DocumentEngine(text).expanded([]).sections[0];
  const rows = expandedRows(
    s,
    "",
    { column: 1, direction: "ASC" },
    {},
    compareNumbers,
  );
  expect(rows.map((r) => r.cells[1].value)).toEqual([
    "2",
    "9007199254740993",
    "1",
  ]);
  expect(rows[0].first).toBe(0);
  expect(rows[0].count).toBe(2);
  expect(
    expandedRows(s, "900719", undefined, {}, compareNumbers)[0].cells[0].value,
  ).toBe("B");
  expect(
    expandedRows(s, "", undefined, { "1": ["number:1"] }, compareNumbers)[0]
      .groupPath,
  ).toEqual([1]);
});
it("preserves missing values and refuses oversized or mixed projections", () => {
  const e = new DocumentEngine('[{"name":"x","items":[{"a":1},{"b":true}]}]');
  expect(e.expanded([]).sections[0].groups[0].children[1][0].cell.type).toBe(
    "missing",
  );
  expect(() =>
    new DocumentEngine('[{"items":[{}]},{"items":1}]').expanded([]),
  ).toThrow(/not an array/);
  expect(() =>
    new DocumentEngine(
      JSON.stringify([
        { items: Array.from({ length: 501 }, () => ({ a: 1 })) },
      ]),
    ).expanded([]),
  ).toThrow(/500 rows/);
});
it("retains the compact parent query and guards clipboard revisions", () => {
  const e = new DocumentEngine(text);
  const q = {
    path: [],
    records: true,
    showIndex: false,
    search: "",
    page: 0,
    sort: { column: 0, direction: "ASC" as const },
  };
  expect(e.expanded([], q).sections[0].groups.map((g) => g.path)).toEqual([
    [1],
    [0],
  ]);
  expect(
    e
      .expanded([], { ...q, filters: { "0": "A" } })
      .sections[0].groups.map((g) => g.path),
  ).toEqual([[1]]);
  const cells = e.expanded([]).sections[0].groups[0].children;
  expect(e.expandedValues(cells, 0)[0][0]).toBe("9007199254740993");
  e.mutate({ action: "replace", path: [0, "name"], raw: '"C"' }, 0);
  expect(() => e.expandedValues(cells, 0)).toThrow();
});
it("preserves extreme number tokens and rejects all expansion size/shape bounds", () => {
  const e = new DocumentEngine(
    '[{"name":"Same","items":[{"n":1e400}]},{"name":"Same","items":[]}]',
  );
  const s = e.expanded([]).sections[0];
  expect(s.groups.map((g) => g.path)).toEqual([[0], [1]]);
  expect(e.expandedValues(s.groups[0].children, 0)[0][0]).toBe("1e400");
  expect(() => new DocumentEngine("{").expanded([])).toThrow(/Repair Source/);
  expect(() =>
    new DocumentEngine(
      JSON.stringify(Array.from({ length: 101 }, () => ({ items: [] }))),
    ).expanded([]),
  ).toThrow(/100 parent/);
  expect(() =>
    new DocumentEngine(
      JSON.stringify([{ items: [], x: "x".repeat(2 * 1024 * 1024) }]),
    ).expanded([]),
  ).toThrow(/2 MiB/);
  expect(() =>
    new DocumentEngine(
      JSON.stringify([
        {
          items: [
            Object.fromEntries(
              Array.from({ length: 21 }, (_, i) => ["c" + i, 1]),
            ),
          ],
        },
      ]),
    ).expanded([]),
  ).toThrow(/20 columns/);
  expect(
    new DocumentEngine('[{"items":[{}]},{"name":"no items"}]').expanded([])
      .sections[0].groups[1].arrayPresent,
  ).toBe(false);
});

it("Tab skips merged continuations without looping back to the parent", () => {
  const rows = [{ index: 0 }, { index: 1 }, { index: 0 }];
  expect(nextExpandedCell(rows, 3, 1, 0, 2, 1)).toEqual({ r: 1, c: 1 });
  expect(nextExpandedCell(rows, 3, 1, 1, 1, -1)).toEqual({ r: 0, c: 2 });
  expect(nextExpandedCell(rows, 3, 1, 1, 2, 1)).toEqual({ r: 2, c: 0 });
});
