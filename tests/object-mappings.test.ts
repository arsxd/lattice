import { expect, it } from "vitest";
import { DocumentEngine } from "../src/document/engine";
const text =
  '{"key1":{"key11":{"val1":1,"val2":2},"key12":{"val1":3,"val2":4}},"key2":{"key21":{"val1":9007199254740993,"val2":6}}}';
it("expands keyed nested mappings as one worksheet with shared parent cells", () => {
  const e = new DocumentEngine(text),
    d = e.expanded([]);
  expect(d.sections).toHaveLength(1);
  const s = d.sections[0];
  expect(s.parentHeaders).toEqual(["Group"]);
  expect(s.childHeaders).toEqual(["Key", "val1", "val2"]);
  expect(s.groups[0].parent[0].value).toBe("key1");
  expect(s.groups[0].children).toHaveLength(2);
  expect(s.groups[1].children[0][1].value).toBe("9007199254740993");
  expect(s.groups[0].children[1][1].cell.path).toEqual([
    "key1",
    "key12",
    "val1",
  ]);
});
it("also works inside a named sheet rather than only All data", () => {
  const s = new DocumentEngine(text).expanded(["key1"]).sections[0];
  expect(s.parentHeaders).toEqual([]);
  expect(s.childHeaders).toEqual(["Key", "val1", "val2"]);
  expect(s.groups[0].children[1][1].cell.path).toEqual([
    "key1",
    "key12",
    "val1",
  ]);
});
it("keeps nested-object field paths unambiguous and preserves undo", () => {
  const e = new DocumentEngine('{"a":{"r":{"settings":{"mode":"on"},"n":1}}}');
  const s = e.expanded([]).sections[0];
  expect(s.childHeaders).toContain("settings / mode");
  const selected = s.groups[0].children[0].find(
    (c) => c.cell.path.at(-1) === "mode",
  )!;
  e.mutate({ action: "replace", path: selected.cell.path, raw: '"off"' }, 0);
  expect(e.raw(["a", "r", "settings", "mode"])).toBe('"off"');
  e.undo();
  expect(e.raw(["a", "r", "settings", "mode"])).toBe('"on"');
});
it("adds mapping rows and retains numeric input types in blank cells", () => {
  const e = new DocumentEngine(text);
  e.mutate({ action: "add-row", path: ["key1"] }, 0);
  const s = e.expanded(["key1"]).sections[0];
  const row = s.groups[0].children.find(
    (row) => row[0].cell.path.at(-1) === "row_1",
  )!;
  expect(row[1].cell.type).toBe("null");
  expect(row[1].cell.inputKind).toBe("number");
});
