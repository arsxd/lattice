import { expect, it } from "vitest";
import { DocumentEngine, compareNumbers } from "../src/document/engine";
import {
  expandedRows,
  nextExpandedCell,
  uniqueGroupEdits,
} from "../src/document/editableGroups";
const text =
  '{"a":{"label":"A","rooms":{"a2":2,"a1":1},"devices":{"devA":true}},"b":{"label":"B","rooms":{"b1":3},"devices":{"devB":false}}}';
const section = () => new DocumentEngine(text).expanded([]).sections[0];
it("shows sibling dictionaries in one sheet with stable grouped columns and nonoverlapping child blocks", () => {
  const all = new DocumentEngine(text).expanded([]);
  expect(all.sections).toHaveLength(1);
  const s = all.sections[0];
  expect(s.parentHeaders).toEqual(["Key", "label"]);
  expect(s.columnPaths).toEqual([
    ["rooms", "Key"],
    ["rooms", "Value"],
    ["devices", "Key"],
    ["devices", "Value"],
  ]);
  const rows = expandedRows(s, "", undefined, {}, compareNumbers);
  expect(rows).toHaveLength(5);
  expect(rows[0].cells[4].layoutGap).toBe(true);
  expect(rows[2].cells[4].value).toBe("devA");
  expect(nextExpandedCell(rows, 6, 2, 1, 3, 1)).toEqual({ r: 2, c: 4 });
});
it("sorts a dictionary independently and preserves its ordering when sorting parent records", () => {
  const s = section();
  const sort = {
    column: 1,
    direction: "DESC" as const,
    scopes: {
      parent: { column: 1, direction: "DESC" as const },
      "dictionary:rooms": { column: 2, direction: "ASC" as const },
    },
  };
  const rows = expandedRows(s, "", sort, {}, compareNumbers);
  expect(rows.map((r) => r.cells[0].value)).toEqual(["b", "b", "a", "a", "a"]);
  expect(rows.map((r) => r.cells[2].value)).toEqual(["b1", "", "a1", "a2", ""]);
  expect(rows[4].cells[4].value).toBe("devA");
  expect(new DocumentEngine(text).text).toBe(text);
});
it("filters key/value together inside one dictionary and ANDs matches across dictionaries", () => {
  const s = section();
  expect(
    expandedRows(
      s,
      "",
      undefined,
      { "2": ["string:a1"], "3": ["number:2"] },
      compareNumbers,
    ),
  ).toHaveLength(0);
  expect(
    expandedRows(
      s,
      "",
      undefined,
      { "2": ["string:a1"], "5": ["boolean:false"] },
      compareNumbers,
    ),
  ).toHaveLength(0);
  const rows = expandedRows(
    s,
    "",
    undefined,
    { "5": ["boolean:false"] },
    compareNumbers,
  );
  expect(rows).toHaveLength(2);
  expect(rows[0].cells[0].value).toBe("b");
  expect(rows[0].cells[2].value).toBe("b1");
  const roomOnly = expandedRows(
    s,
    "",
    undefined,
    { "2": ["string:a1"] },
    compareNumbers,
  );
  expect(roomOnly).toHaveLength(2);
  expect(roomOnly[1].cells[4].value).toBe("devA");
});
it("keeps unequal lists independent, without Cartesian rows or writable invented cells", () => {
  const s = new DocumentEngine(
    '{"a":{"label":"A","rooms":{"x":1,"y":2},"devices":{"d1":true,"d2":false,"d3":true}},"b":{"label":"B","rooms":{},"devices":{"d4":false}}}',
  ).expanded([]).sections[0];
  const rows = expandedRows(s, "", undefined, {}, compareNumbers);
  expect(rows).toHaveLength(6);
  expect(rows[2].cells[2].cell.type).toBe("missing");
  expect(rows[2].cells[2].cell.writable).toBe(false);
  expect(rows[5].cells[4].value).toBe("d4");
});
it("edits original paths and atomically rejects conflicting paste into a merged value", () => {
  const e = new DocumentEngine(text),
    rows = expandedRows(
      e.expanded([]).sections[0],
      "",
      undefined,
      {},
      compareNumbers,
    );
  expect(rows[2].cells[5].cell.path).toEqual(["a", "devices", "devA"]);
  expect(() =>
    uniqueGroupEdits([
      { cell: rows[2].cells[5].cell, raw: "true" },
      { cell: rows[2].cells[5].cell, raw: "false" },
    ]),
  ).toThrow(/different values/);
  e.mutate(
    { action: "replace", path: rows[0].cells[3].cell.path, raw: "1e400" },
    0,
  );
  expect(e.raw(["a", "rooms", "a2"])).toBe("1e400");
  e.undo();
  expect(e.text).toBe(text);
});
it("supports three independent dictionaries and keeps complete search matches", () => {
  const e = new DocumentEngine(
    '{"a":{"label":"A","rooms":{"x":1,"y":2},"devices":{"d":true},"parent":{"p":4}},"b":{"label":"B","rooms":{"z":3},"devices":{"e":false},"parent":{"q":5}}}',
  );
  const s = e.expanded([]).sections[0];
  expect(s.dictionaryBands).toHaveLength(3);
  const rows = expandedRows(s, "y", undefined, {}, compareNumbers);
  expect(rows).toHaveLength(4);
  expect(rows[0].cells[2].value).toBe("x");
  const sorted = expandedRows(
    s,
    "",
    {
      column: 1,
      direction: "DESC",
      scopes: {
        parent: { column: 1, direction: "DESC" },
        "dictionary:parent": { column: 7, direction: "ASC" },
      },
    },
    {},
    compareNumbers,
  );
  expect(sorted[0].cells[0].value).toBe("b");
  expect(sorted[2].cells[7].value).toBe("5");
});

it("never places sibling dictionary entries on the same display row", () => {
  const s = new DocumentEngine(
    '{"a":{"label":"A","rooms":{"a1":1,"a2":2},"devices":{"devA":true,"devC":false}},"b":{"label":"B","rooms":{"b1":3},"devices":{"devB":false}}}',
  ).expanded([]).sections[0];
  const rows = expandedRows(s, "", undefined, {}, compareNumbers);
  expect(rows).toHaveLength(6);
  for (const row of rows)
    expect([2, 4].filter((c) => !row.cells[c].layoutGap)).toHaveLength(1);
  expect(rows[1].cells[2].value).toBe("a2");
  expect(rows[1].cells[4].value).toBe("");
  expect(rows[3].cells[4].value).toBe("devC");
});
