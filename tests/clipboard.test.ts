import { it, expect } from "vitest";
import { parseTSV, toTSV, readRange } from "../src/grid/clipboard";
import { DocumentEngine } from "../src/document/engine";
it("round trips spreadsheet quotes, tabs, newlines and blanks", () => {
  const cells = [
    ["a\tb", 'quote"here', ""],
    ["line\nbreak", "001", "false"],
  ];
  expect(parseTSV(toTSV(cells))).toEqual(cells);
});
it("accepts Excel CRLF with trailing newline and rejects ragged paste", () => {
  expect(parseTSV("a\tb\r\nc\td\r\n")).toEqual([
    ["a", "b"],
    ["c", "d"],
  ]);
  expect(() => parseTSV("a\tb\nc")).toThrow();
});
it("commits multi-cell edits in one undo step with precise numbers", () => {
  const text = '{"a":1,"b":2}';
  const d = new DocumentEngine(text);
  d.mutate(
    {
      action: "batch",
      commands: [
        { action: "replace", path: ["a"], raw: "9007199254740993" },
        { action: "replace", path: ["b"], raw: "1e400" },
      ],
    },
    0,
  );
  expect(d.raw(["a"])).toBe("9007199254740993");
  d.undo();
  expect(d.text).toBe(text);
  d.redo();
  expect(d.raw(["b"])).toBe("1e400");
});
it("rejects a whole batch if a later edit is invalid", () => {
  const d = new DocumentEngine('{"a":1,"b":2}');
  expect(() =>
    d.mutate(
      {
        action: "batch",
        commands: [
          { action: "replace", path: ["a"], raw: "5" },
          { action: "replace", path: ["b"], raw: "01" },
        ],
      },
      0,
    ),
  ).toThrow();
  expect(d.text).toBe('{"a":1,"b":2}');
  expect(d.revision).toBe(0);
});
it("inserts array rows in position and duplicates exact numeric tokens", () => {
  const d = new DocumentEngine('[{"n":1e400},{"n":2}]');
  d.mutate(
    { action: "relative-row", path: [0], where: "after", duplicate: true },
    0,
  );
  expect(d.raw([1])).toBe('{"n":1e400}');
  d.undo();
  expect(d.text).toBe('[{"n":1e400},{"n":2}]');
  d.mutate({ action: "relative-row", path: [1], where: "before" }, d.revision);
  expect(d.raw([1, "n"])).toBe("null");
});
it("creates unique object row keys without replacing existing rows", () => {
  const d = new DocumentEngine('{"1":{"v":1},"2":{"v":2}}');
  d.mutate(
    { action: "relative-row", path: ["1"], where: "before", duplicate: true },
    0,
  );
  expect(d.text).toBe('{"3": {"v":1}, "1":{"v":1},"2":{"v":2}}');
  d.undo();
  expect(d.raw(["1", "v"])).toBe("1");
});
it("renames columns beyond the first page as one undoable edit", () => {
  const text = JSON.stringify(
    Array.from({ length: 501 }, (_, i) => ({ old: i })),
  );
  const d = new DocumentEngine(text);
  d.mutate({ action: "column-edit", path: [], key: "old", name: "new" }, 0);
  expect(d.raw([500, "new"])).toBe("500");
  d.undo();
  expect(d.text).toBe(text);
});
it("rejects column collisions without partial changes", () => {
  const text = '[{"a":1},{"a":2,"b":3}]';
  const d = new DocumentEngine(text);
  expect(() =>
    d.mutate({ action: "column-edit", path: [], key: "a", name: "b" }, 0),
  ).toThrow();
  expect(d.text).toBe(text);
});
it("combines column filters without modifying file contents", () => {
  const text =
    '[{"name":"Alpha","kind":"input"},{"name":"Alpha","kind":"output"},{"name":"Beta","kind":"input"}]';
  const d = new DocumentEngine(text);
  const p = d.project({
    path: [],
    records: true,
    search: "",
    page: 0,
    filters: { "1": "alpha", "2": "input" },
  });
  expect(p.matched).toBe(1);
  expect(p.rows[0].path).toEqual([0]);
  expect(d.text).toBe(text);
});
it("lists filter values across pages and filters by exact typed keys", () => {
  const d = new DocumentEngine(
    JSON.stringify(
      Array.from({ length: 501 }, (_, i) => ({
        v: i === 500 ? "last" : "first",
      })),
    ),
  );
  const q = { path: [], records: true, search: "", page: 0 };
  const p = d.project({ ...q, optionsColumn: 1 });
  const key = p.filterOptions!.find((v) => v.label === "last")!.key;
  expect(
    d.project({ ...q, valueFilters: { "1": [key] } }).rows[0].path,
  ).toEqual([500]);
  expect(d.project({ ...q, valueFilters: { "1": [] } }).matched).toBe(0);
});
it("distinguishes missing, null, empty strings and exact numeric filter values", () => {
  const d = new DocumentEngine(
    '[{}, {"v":null},{"v":""},{"v":9007199254740993},{"v":"9007199254740993"}]',
  );
  const q = { path: [], records: true, search: "", page: 0 };
  const options = d.project({ ...q, optionsColumn: 1 }).filterOptions!;
  expect(options).toHaveLength(5);
  for (const value of options)
    expect(
      d.project({ ...q, valueFilters: { "1": [value.key] } }).matched,
    ).toBe(1);
});
it("locates the exact selected value and its containing field", () => {
  const d = new DocumentEngine(
    '{"a":7,"rows":[{"a":7},{"a":9007199254740993}]}',
  );
  const span = d.locate(["rows", 1, "a"]);
  expect(d.text.slice(span.from, span.to)).toBe("9007199254740993");
  const field = d.locate(["rows", 0, "a"], true);
  expect(d.text.slice(field.from, field.to)).toBe('"a":7');
});
it("shows primitive arrays inline and removes generated type columns", () => {
  const d = new DocumentEngine('{"one":[100],"many":[1,2,3,4]}');
  const p = d.project({ path: [], records: false, search: "", page: 0 });
  expect(p.headers).toEqual(["Key", "Value"]);
  expect(p.rows[0].cells[1]).toMatchObject({
    display: "[100]",
    container: false,
  });
  expect(p.rows[1].cells[1].display).toBe("[1, 2, 3, 4]");
});
it("exposes array groups inside a single wrapper as sheets", () => {
  const d = new DocumentEngine(
    '{"swc_interface":{"Feature_params":[{"key":"val"}],"phy_params":[{"pin":1}]}}',
  );
  const p = d.project({ path: [], records: true, search: "", page: 0 });
  expect(p.sheets?.map((s) => s.path)).toEqual([
    ["swc_interface", "Feature_params"],
    ["swc_interface", "phy_params"],
  ]);
});
it("keeps established columns when filling a field missing from the first row", () => {
  const d = new DocumentEngine('[{}, {"a":1,"b":2}]');
  const q = { path: [], records: true, search: "", page: 0 };
  const before = d.project(q).headers;
  d.mutate({ action: "insert", path: [0], key: "b", raw: "9" }, 0);
  expect(d.project(q).headers).toEqual(before);
  d.mutate({ action: "insert", path: [0], key: "a", raw: "8" }, d.revision);
  expect(d.project(q).headers).toEqual(before);
  d.undo();
  expect(d.project(q).headers).toEqual(before);
});
it("retains the renamed column position through batch and Undo", () => {
  const d = new DocumentEngine('[{"a":1,"b":2}]');
  const q = { path: [], records: true, search: "", page: 0 };
  d.project(q);
  d.mutate(
    {
      action: "batch",
      commands: [
        { action: "column-edit", path: [], key: "a", name: "renamed" },
      ],
    },
    0,
  );
  expect(d.project(q).headers).toEqual(["Index", "renamed", "b"]);
  d.undo();
  expect(d.project(q).headers).toEqual(["Index", "a", "b"]);
});
it("renames a newly added object row without changing values and rejects duplicate keys", () => {
  const d = new DocumentEngine('{"1":{"v":9007199254740993}}');
  d.mutate({ action: "add-row", path: [] }, 0);
  d.mutate({ action: "rename", path: ["2"], key: "SignalName" }, d.revision);
  expect(d.raw(["SignalName"])).toBe('{"v": null}');
  expect(d.raw(["1", "v"])).toBe("9007199254740993");
  const before = d.text;
  expect(() =>
    d.mutate({ action: "rename", path: ["SignalName"], key: "1" }, d.revision),
  ).toThrow();
  expect(d.text).toBe(before);
  d.undo();
  expect(d.raw(["2", "v"])).toBe("null");
});

it("copies exact values rather than truncated displays, including scalar roots", async () => {
  const text =
    '[{"s":"first\\nsecond","n":9007199254740993,"a":[1,2]},{"n":1e400}]';
  const engine = new DocumentEngine(text);
  const view = engine.project({ path: [], records: true, search: "", page: 0 });
  const result = await readRange(
    view,
    { r1: 0, r2: 1, c1: 1, c2: 3 },
    async (path) => engine.raw(path),
  );
  expect(parseTSV(result)).toEqual([
    ["first\nsecond", "9007199254740993", "[1,2]"],
    ["", "1e400", ""],
  ]);
  const scalar = new DocumentEngine('"literal"');
  expect(
    await readRange(
      scalar.project({ path: [], records: false, search: "", page: 0 }),
      { r1: 0, r2: 0, c1: 0, c2: 0 },
      async (path) => scalar.raw(path),
    ),
  ).toBe("literal");
});
it("rejects unavailable or oversized copy ranges rather than silently truncating", async () => {
  const engine = new DocumentEngine("[1]");
  const view = engine.project({ path: [], records: true, search: "", page: 0 });
  await expect(
    readRange(view, { r1: 0, r2: 1, c1: 1, c2: 1 }, async (path) =>
      engine.raw(path),
    ),
  ).rejects.toThrow("no longer available");
  await expect(
    readRange(view, { r1: 0, r2: 10000, c1: 0, c2: 0 }, async (path) =>
      engine.raw(path),
    ),
  ).rejects.toThrow("10,000");
});
