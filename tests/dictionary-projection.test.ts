import { expect, it } from "vitest";
import { DocumentEngine, compareNumbers } from "../src/document/engine";
import { expandedRows } from "../src/document/editableGroups";
const text =
  '{"first":{"name":"A","attributes":{"alpha":9007199254740993,"beta":true}},"second":{"name":"B","attributes":{"gamma":"three"}}}';
it("uses two subcolumns for nested dictionaries with disjoint keys", () => {
  const section = new DocumentEngine(text).expanded([]).sections[0];
  expect(section.parentHeaders).toEqual(["Key", "name"]);
  expect(section.columnPaths).toEqual([
    ["attributes", "Key"],
    ["attributes", "Value"],
  ]);
  expect(section.childHeaders).toHaveLength(2);
  expect(section.groups[0].children).toHaveLength(2);
  expect(section.groups[0].children[0][0].identifier).toBe("alpha");
  expect(section.groups[0].children[0][1].value).toBe("9007199254740993");
  expect(section.groups[0].children[0][1].cell.path).toEqual([
    "first",
    "attributes",
    "alpha",
  ]);
});
it("keeps shared schemas as regular columns and arrays of heterogeneous records unchanged", () => {
  const shared = new DocumentEngine(
    '{"a":{"name":"A","details":{"pages":10}},"b":{"name":"B","details":{"pages":20}}}',
  ).expanded([]).sections[0];
  expect(shared.childHeaders).toContain("details / pages");
  const array = new DocumentEngine('[{"alpha":1},{"beta":2}]').expanded([])
    .sections[0];
  expect(array.childHeaders).toEqual(["alpha", "beta"]);
});
it("renders wholly disjoint dictionary records as parent/key/value rows without sparse columns", () => {
  const section = new DocumentEngine(
    '{"first":{"unique_a":1,"unique_b":2},"second":{"unique_c":3}}',
  ).expanded([]).sections[0];
  expect(section.parentHeaders).toEqual(["Key"]);
  expect(section.childHeaders).toEqual(["Key", "Value"]);
  expect(expandedRows(section, "", undefined, {}, compareNumbers)).toHaveLength(
    3,
  );
});
it("edits values, renames keys, preserves undo, and filters/sorts within their parent dictionaries", () => {
  const engine = new DocumentEngine(text),
    section = engine.expanded([]).sections[0];
  const target = section.groups[0].children[0][1].cell.path;
  engine.mutate({ action: "replace", path: target, raw: "1e400" }, 0);
  expect(engine.raw(target)).toBe("1e400");
  engine.undo();
  expect(engine.text).toBe(text);
  engine.mutate(
    { action: "rename", path: target, key: "renamed" },
    engine.revision,
  );
  expect(engine.raw(["first", "attributes", "renamed"])).toBe(
    "9007199254740993",
  );
  engine.undo();
  expect(engine.text).toBe(text);
  const rows = expandedRows(
    section,
    "",
    { column: 2, direction: "DESC" },
    {},
    compareNumbers,
  );
  expect(rows[0].cells[2].value).toBe("beta");
  const filtered = expandedRows(
    section,
    "gamma",
    undefined,
    {},
    compareNumbers,
  );
  expect(filtered).toHaveLength(1);
  expect(filtered[0].cells[0].value).toBe("second");
});
it("avoids the old column explosion while retaining row bounds", () => {
  const dictionary = (prefix: string, count: number) =>
    Object.fromEntries(
      Array.from({ length: count }, (_, i) => [`${prefix}${i}`, i]),
    );
  const section = new DocumentEngine(
    JSON.stringify({ a: dictionary("a", 101), b: dictionary("b", 101) }),
  ).expanded([]).sections[0];
  expect(section.parentHeaders.length + section.childHeaders.length).toBe(3);
  expect(section.groups.reduce((sum, g) => sum + g.children.length, 0)).toBe(
    202,
  );
  expect(() =>
    new DocumentEngine(
      JSON.stringify({ a: dictionary("a", 251), b: dictionary("b", 251) }),
    ).expanded([]),
  ).toThrow(/500 rows/);
});
it("keeps empty dictionaries and shared parent numeric input guidance", () => {
  const section = new DocumentEngine(
    '{"a":{"count":1,"attributes":{"first":1}},"b":{"count":null,"attributes":{"second":2}},"c":{"count":3,"attributes":{}}}',
  ).expanded([]).sections[0];
  expect(section.groups).toHaveLength(3);
  expect(section.groups[1].parent[1].cell.inputKind).toBe("number");
  expect(section.groups[2].children).toHaveLength(0);
});
it("uses paired columns when a few shared keys still leave a mostly empty wide dictionary", () => {
  const row = (prefix: string) => ({
    name: prefix,
    attributes: {
      shared: true,
      ...Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [prefix + i, i]),
      ),
    },
  });
  const section = new DocumentEngine(
    JSON.stringify({ a: row("a"), b: row("b"), c: row("c") }),
  ).expanded([]).sections[0];
  expect(section.columnPaths).toEqual([
    ["attributes", "Key"],
    ["attributes", "Value"],
  ]);
  expect(section.groups[0].children).toHaveLength(13);
});
it("keeps deeper dictionary paths as key/value rows instead of sparse path columns", () => {
  const engine = new DocumentEngine(
    '{"a":{"name":"A","metadata":{"settings":{"a1":1,"a2":2}}},"b":{"name":"B","metadata":{"other":{"b1":3}}}}',
  );
  const section = engine.expanded([]).sections[0];
  expect(section.childHeaders).toHaveLength(2);
  expect(section.groups[0].children[0][0].value).toBe("settings / a1");
  expect(section.groups[0].children[0][1].cell.path).toEqual([
    "a",
    "metadata",
    "settings",
    "a1",
  ]);
});
it("lifts a dictionary's shared path into its grouped headers without changing edit paths", () => {
  const e = new DocumentEngine(
    '{"a":{"name":"A","metadata":{"level_2":{"level_1":{"x":1,"y":2}}}},"b":{"name":"B","metadata":{"level_2":{"level_1":{"z":3}}}}}',
  );
  const s = e.expanded([]).sections[0];
  expect(s.columnPaths).toEqual([
    ["metadata / level_2 / level_1", "Key"],
    ["metadata / level_2 / level_1", "Value"],
  ]);
  expect(s.groups[0].children[0][0].value).toBe("x");
  expect(s.groups[0].children[0][1].cell.path).toEqual([
    "a",
    "metadata",
    "level_2",
    "level_1",
    "x",
  ]);
});
