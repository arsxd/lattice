import { expect, it } from "vitest";
import { DocumentEngine } from "../src/document/engine";
import { fieldColumnKey } from "../src/grid/columnRoles";
const q = { path: [], records: true, search: "", page: 0 };
it("keeps generated mixed-item columns distinct from a real identically named field", () => {
  const source = '[{"Single value":1,"Array value":2},5]';
  const engine = new DocumentEngine(source);
  const view = engine.project(q);
  expect(view.columnKinds).toEqual(["index", "field", "field", "mixed"]);
  expect(fieldColumnKey(view, 1)).toBe("Single value");
  expect(() => fieldColumnKey(view, 3)).toThrow("not a JSON property");
  expect(engine.text).toBe(source);
  engine.mutate(
    { action: "column-edit", path: [], key: fieldColumnKey(view, 1) },
    view.revision,
  );
  expect(engine.raw([0])).toBe('{"Array value":2}');
});
it("never treats row identifiers or property/value views as editable record fields", () => {
  const engine = new DocumentEngine('{"Value":1,"Key":2}');
  const view = engine.project({ ...q, records: false });
  expect(view.columnKinds).toEqual(["key", "value"]);
  expect(() => fieldColumnKey(view, 0)).toThrow();
  expect(() => fieldColumnKey(view, 1)).toThrow();
});
