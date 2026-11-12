import { expect, it } from "vitest";
import { DocumentEngine } from "../src/document/engine";
import { selectCell } from "../src/document/sheetSelection";
import {
  captureReloadPosition,
  remapReloadQuery,
  restoreReloadSelection,
} from "../src/workspace/reloadPosition";
const query = { path: [], records: true, search: "", page: 1 };
it("locates a retained row beyond one page after filtering and exact numeric sorting", () => {
  const engine = new DocumentEngine(
    "{" +
      Array.from(
        { length: 1100 },
        (_, i) =>
          `"k${i}":{"n":${9007199254740991000n + BigInt(i)},"group":"keep"}`,
      ).join(",") +
      "}",
  );
  const q = {
    ...query,
    filters: { "2": "keep" },
    sort: { column: 1, direction: "DESC" as const },
  };
  const old = engine.project(q);
  const snapshot = captureReloadPosition(
    old,
    selectCell(null, { r: 620, c: 1 }),
  );
  const result = engine.project(q, undefined, snapshot!.rowPath);
  expect(result.locatedRow).toBe(620);
  expect(
    restoreReloadSelection(snapshot, result, result.locatedRow)?.anchor,
  ).toEqual({ r: 620, c: 1 });
  expect(engine.raw(snapshot!.rowPath.concat("n"))).toBe("9007199254740991479");
});
it("remaps field identities after column reordering and drops deleted columns", () => {
  const before = new DocumentEngine('{"one":{"a":1,"b":2}}').project(query);
  const snapshot = captureReloadPosition(
    before,
    selectCell(null, { r: 0, c: 2 }),
  );
  const after = new DocumentEngine('{"one":{"b":3,"a":4}}').project(query);
  expect(restoreReloadSelection(snapshot, after, 0)?.anchor.c).toBe(1);
  expect(
    remapReloadQuery(
      {
        ...query,
        filters: { "1": "x" },
        valueFilters: { "2": ["v"] },
        sort: { column: 2, direction: "ASC" },
      },
      before,
      after,
    ),
  ).toMatchObject({
    filters: { "2": "x" },
    valueFilters: { "1": ["v"] },
    sort: { column: 1, direction: "ASC" },
  });
  const deleted = new DocumentEngine('{"one":{"a":1}}').project(query);
  expect(restoreReloadSelection(snapshot, deleted, 0)).toBeNull();
  expect(
    remapReloadQuery(
      { ...query, sort: { column: 2, direction: "ASC" } },
      before,
      deleted,
    ).sort,
  ).toBeUndefined();
});
it("does not confuse generated columns with real fields or restore a missing row", () => {
  const engine = new DocumentEngine('{"one":{"Key":1},"two":{"Key":2}}');
  const view = engine.project(query);
  expect(view.columnKinds).toEqual(["key", "field"]);
  const snapshot = captureReloadPosition(
    view,
    selectCell(null, { r: 0, c: 1 }),
  );
  const next = new DocumentEngine('{"two":{"Key":2}}').project(
    query,
    undefined,
    snapshot!.rowPath,
  );
  expect(next.locatedRow).toBeUndefined();
  expect(restoreReloadSelection(snapshot, next, next.locatedRow)).toBeNull();
  expect(
    captureReloadPosition(view, selectCell(null, { r: 900, c: 1 })),
  ).toBeNull();
});
it("locates only rows visible in the current filter and treats array paths as positional", () => {
  const engine = new DocumentEngine('[{"id":1},{"id":2}]');
  expect(
    engine.project({ ...query, search: "2" }, undefined, [0]).locatedRow,
  ).toBeUndefined();
  expect(engine.project(query, undefined, [1]).locatedRow).toBe(1);
});
it("clears a deleted cell even when its column survives on another row", () => {
  const before = new DocumentEngine('{"one":{"a":1},"two":{"a":2}}').project(
    query,
  );
  const snapshot = captureReloadPosition(
    before,
    selectCell(null, { r: 0, c: 1 }),
  );
  const after = new DocumentEngine('{"one":{},"two":{"a":2}}').project(
    query,
    undefined,
    snapshot!.rowPath,
  );
  expect(restoreReloadSelection(snapshot, after, after.locatedRow)).toBeNull();
});
it("captures an explicit visible fallback row without inventing a selection", () => {
  const engine = new DocumentEngine(
    JSON.stringify(Array.from({ length: 650 }, (_, i) => ({ a: i }))),
  );
  const view = engine.project(query);
  const snapshot = captureReloadPosition(view, null, 570);
  expect(snapshot).toMatchObject({ rowPath: [570], selected: false });
  const after = engine.project(query, undefined, snapshot!.rowPath);
  expect(after.locatedRow).toBe(570);
  expect(restoreReloadSelection(snapshot, after, 570)).toBeNull();
});
