import { expect, it } from "vitest";
import { DocumentEngine } from "../src/document/engine";
import { groupedView } from "../src/document/groupedView";
it("keeps equal-looking parents distinct, child paths exact and sibling arrays separate", () => {
  const engine = new DocumentEngine(
    '[{"name":"Same","items":[{"id":9007199254740993},{"id":1e400}],"other":[{"x":1}]},{"name":"Same","items":[{"id":2}]}]',
  );
  const grouped = engine.grouped([], "items");
  expect(grouped.groups.map((group) => group.path)).toEqual([[0], [1]]);
  expect(grouped.groups[0].children.map((row) => row[0].text)).toEqual([
    "9007199254740993",
    "1e400",
  ]);
  expect(grouped.groups[0].children[1][0].path).toEqual([0, "items", 1, "id"]);
  expect(grouped.childHeaders).toEqual(["id"]);
  expect(engine.grouped([], "other").childHeaders).toEqual(["x"]);
});
it("sorts within groups and filters children without losing parent identity", () => {
  const engine = new DocumentEngine(
    '[{"name":"B","items":[{"n":3},{"n":1}]},{"name":"A","items":[{"n":2}]}]',
  );
  const p = engine.grouped([], "items");
  expect(
    groupedView(p, "", {
      scope: "child",
      column: 0,
      descending: false,
    }).groups[0].children.map((row) => row[0].text),
  ).toEqual(["1", "3"]);
  expect(
    groupedView(p, "", {
      scope: "parent",
      column: 0,
      descending: false,
    }).groups.map((group) => group.path),
  ).toEqual([[1], [0]]);
  const filtered = groupedView(p, "3");
  expect(filtered.groups[0].path).toEqual([0]);
  expect(filtered.groups[0].children).toHaveLength(1);
  expect(groupedView(p, "B").groups[0].children).toHaveLength(2);
  expect(p.groups[0].children[0][0].text).toBe("3");
});
it("retains empty parents and real fields named Key in object maps", () => {
  const p = new DocumentEngine(
    '{"first":{"Key":"data","items":[]},"second":{"Key":"two","items":[{}]}}',
  ).grouped([], "items");
  expect(p.parentHeaders).toEqual(["Key", "Key"]);
  expect(p.groups[0].parent.map((cell) => cell.text)).toEqual([
    "first",
    "data",
  ]);
  expect(p.groups[0].children).toHaveLength(0);
  expect(groupedView(p, "first").groups).toHaveLength(1);
});
it("refuses invalid, oversized and incompatible projections rather than truncating", () => {
  expect(() => new DocumentEngine("{").grouped([], "items")).toThrow(
    /valid JSON/,
  );
  expect(() => new DocumentEngine("[1]").grouped([], "items")).toThrow(
    /records/,
  );
  expect(() =>
    new DocumentEngine('[{"items":[1]}]').grouped([], "items"),
  ).toThrow(/child records/);
  expect(() =>
    new DocumentEngine(
      JSON.stringify(Array.from({ length: 101 }, () => ({ items: [] }))),
    ).grouped([], "items"),
  ).toThrow(/100 parent/);
  expect(() =>
    new DocumentEngine(
      JSON.stringify([
        { items: Array.from({ length: 501 }, () => ({ n: 1 })) },
      ]),
    ).grouped([], "items"),
  ).toThrow(/500 child/);
  expect(() =>
    new DocumentEngine(
      JSON.stringify([{ items: [], huge: "x".repeat(2 * 1024 * 1024) }]),
    ).grouped([], "items"),
  ).toThrow(/2 MiB/);
  expect(() =>
    new DocumentEngine(
      JSON.stringify([
        {
          items: [
            Object.fromEntries(
              Array.from({ length: 21 }, (_, i) => ["c" + i, i]),
            ),
          ],
        },
      ]),
    ).grouped([], "items"),
  ).toThrow(/20 columns/);
});
