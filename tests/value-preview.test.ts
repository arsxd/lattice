import { expect, it } from "vitest";
import { objectPreview } from "../src/editor/objectPreview";
import { DocumentEngine, type Query } from "../src/document/engine";
const query: Query = { path: [], records: true, search: "", page: 0 };
it("distinguishes empty values, null, absence, zero and false without altering JSON", () => {
  const text = '[{"s":"","o":{},"a":[],"n":null,"v":0,"b":false},{"v":1}]';
  const engine = new DocumentEngine(text);
  const view = engine.project(query);
  const field = (row: number, key: string) =>
    view.rows[row].cells[view.headers.indexOf(key)];
  expect(["s", "o", "a", "n"].map((k) => field(0, k).display)).toEqual([
    '""',
    "{}",
    "[]",
    "null",
  ]);
  expect(field(1, "s").display).toBe("missing");
  expect(field(0, "v").display).toBe("0");
  expect(field(0, "b").display).toBe("false");
  expect(field(0, "o").container).toBe(true);
  expect(engine.text).toBe(text);
});
it("summarizes objects without rounding numeric tokens", () => {
  const text =
    '{"entry":{"id":9007199254740993,"big":1e400,"nested":{},"extra":1}}';
  const engine = new DocumentEngine(text);
  const view = engine.project({ ...query, records: false });
  expect(view.rows[0].cells.at(-1)?.display).toBe(
    "id: 9007199254740993, big: 1e400, nested: {0 fields}, …",
  );
  expect(objectPreview(engine.raw(["entry"]))?.rows.slice(0, 2)).toEqual([
    { key: "id", value: "9007199254740993" },
    { key: "big", value: "1e400" },
  ]);
  expect(engine.text).toBe(text);
});
it("bounds details preview rows and skips very large selections", () => {
  const values = Array.from({ length: 40 }, (_, i) => i);
  expect(objectPreview(JSON.stringify(values))).toMatchObject({ total: 40 });
  expect(objectPreview(JSON.stringify(values))?.rows).toHaveLength(30);
  expect(objectPreview('"' + "x".repeat(128 * 1024) + '"')).toBeNull();
});
