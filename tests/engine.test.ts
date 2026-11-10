import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  DocumentEngine,
  compareNumbers,
  type Query,
} from "../src/document/engine";
const q: Query = { path: [], records: true, search: "", page: 0 };
describe("lossless document engine", () => {
  it("preserves BOM, CRLF, escape spelling and arbitrary numbers through edit/undo/save", () => {
    const text =
      '\ufeff{\r\n  "id":9007199254740993,"big":1e400,"decimal":0.123456789012345678901,"negative":-0,"s":"\\u0041","v":1\r\n}\r\n';
    const d = new DocumentEngine(text);
    expect(d.diagnostics).toEqual([]);
    expect(d.text).toBe(text);
    d.mutate({ action: "replace", path: ["v"], raw: "2" }, 0);
    expect(d.text).toBe(text.replace('"v":1', '"v":2'));
    d.undo();
    expect(d.text).toBe(text);
    expect(d.project(q).dirty).toBe(false);
    d.redo();
    expect(d.raw(["id"])).toBe("9007199254740993");
  });
  it.each([
    "null",
    "true",
    "0",
    '""',
    "[]",
    "{}",
    '[1,null,"",{}]',
    '{"a":{"b":[]}}',
  ])("handles any shape: %s", (text) => {
    const d = new DocumentEngine(text);
    expect(d.diagnostics).toEqual([]);
    expect(() => d.project(q)).not.toThrow();
    expect(d.text).toBe(text);
  });
  it("rejects duplicates including escaped equivalents without dropping data", () => {
    const t = '{"a":1,"\\u0061":2}';
    const d = new DocumentEngine(t);
    expect(d.diagnostics[0].message).toContain("Duplicate");
    expect(() =>
      d.mutate({ action: "replace", path: ["a"], raw: "3" }, 0),
    ).toThrow();
    expect(d.text).toBe(t);
  });
  it.each(['{"a":1,}', "//comment\n{}", "NaN", "0xFF", "[01]", '{"s":"a\nb"}'])(
    "reports invalid JSON %s",
    (t) => expect(new DocumentEngine(t).diagnostics.length).toBeGreaterThan(0),
  );
  it("allows invalid source and unified undo repair", () => {
    const d = new DocumentEngine("{}");
    d.source("{", 0);
    expect(d.diagnostics.length).toBeGreaterThan(0);
    d.undo();
    expect(d.text).toBe("{}");
    d.redo();
    expect(d.text).toBe("{");
  });
  it("rejects stale edit targets", () => {
    const d = new DocumentEngine("[1,2]");
    d.mutate({ action: "remove", path: [0] }, 0);
    expect(() =>
      d.mutate({ action: "replace", path: [0], raw: "3" }, 0),
    ).toThrow(/changed/);
    expect(d.text).toBe("[2]");
  });
  it("preserves missing, null, empty, false and zero", () => {
    const d = new DocumentEngine(
      '[{}, {"v":null}, {"v":""}, {"v":false}, {"v":0}]',
    );
    expect(d.project(q).rows.map((r) => r.cells[1].type)).toEqual([
      "missing",
      "null",
      "string",
      "boolean",
      "number",
    ]);
  });
  it("sort targets remain source paths and filtering never alters text", () => {
    const d = new DocumentEngine(
      '[{"v":9007199254740993},{"v":9007199254740992}]',
    );
    const p = d.project({ ...q, sort: { column: 1, direction: "ASC" } });
    expect(p.rows[0].path).toEqual([1]);
    d.mutate(
      { action: "replace", path: p.rows[0].cells[1].path, raw: "-0" },
      p.revision,
    );
    expect(d.text).toBe('[{"v":9007199254740993},{"v":-0}]');
    const before = d.text;
    d.project({ ...q, search: "not found" });
    expect(d.text).toBe(before);
  });
  it("key paths do not treat dots or prototype keys specially", () => {
    const d = new DocumentEngine(
      '{"a.b":1,"a":{"b":2},"__proto__":3,"/":4,"~":5}',
    );
    d.mutate({ action: "replace", path: ["a.b"], raw: "6" }, 0);
    expect(d.raw(["a", "b"])).toBe("2");
    expect(d.raw(["__proto__"])).toBe("3");
  });
  it.each(["[1, 2, 3]", '{ "a":1, "b":2, "c":3 }'])(
    "removes each position correctly: %s",
    (text) => {
      for (let i = 0; i < 3; i++) {
        const d = new DocumentEngine(text);
        d.mutate(
          {
            action: "remove",
            path: [text[0] === "[" ? i : ["a", "b", "c"][i]],
          },
          0,
        );
        expect(d.diagnostics).toEqual([]);
        expect(Object.keys(JSON.parse(d.text))).toHaveLength(2);
        d.undo();
        expect(d.text).toBe(text);
      }
    },
  );
  it("inserts raw values and renames without reserializing siblings", () => {
    const d = new DocumentEngine('{\n  "id": 1e400\n}');
    d.mutate(
      { action: "insert", path: [], key: "new", raw: "9007199254740993" },
      0,
    );
    expect(d.raw(["id"])).toBe("1e400");
    expect(d.raw(["new"])).toBe("9007199254740993");
    d.mutate({ action: "rename", path: ["new"], key: "renamed" }, 1);
    expect(d.raw(["renamed"])).toBe("9007199254740993");
    expect(() =>
      d.mutate({ action: "rename", path: ["renamed"], key: "id" }, 2),
    ).toThrow(/already/);
  });
  it.each(["[]", "[\n]", "{}", "{\n}"])(
    "inserts into empty container %s",
    (text) => {
      const d = new DocumentEngine(text);
      d.mutate({ action: "insert", path: [], key: "x", raw: "1e400" }, 0);
      expect(d.diagnostics).toEqual([]);
      expect(d.text).toContain("1e400");
      d.undo();
      expect(d.text).toBe(text);
    },
  );
  it("scalar fast path keeps nested spans valid across size changes and whitespace", () => {
    const d = new DocumentEngine('{"a":[1,{"b":"x","c":false}],"z":4}');
    d.mutate({ action: "replace", path: ["a", 0], raw: "  12345  " }, 0);
    d.mutate({ action: "replace", path: ["a", 1, "b"], raw: '"longer 😀"' }, 1);
    expect(d.raw(["z"])).toBe("4");
    expect(d.raw(["a", 1])).toBe('{"b":"longer 😀","c":false}');
    d.mutate({ action: "replace", path: ["a", 1, "c"], raw: "null" }, 2);
    expect(JSON.parse(d.text)).toEqual({
      a: [12345, { b: "longer 😀", c: null }],
      z: 4,
    });
    d.undo();
    d.undo();
    d.undo();
    expect(d.text).toBe('{"a":[1,{"b":"x","c":false}],"z":4}');
  });
  it("generated scalar edits preserve untouched siblings and offsets", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
          { minLength: 1, maxLength: 40 },
        ),
        fc.string(),
        (values, newValue) => {
          const d = new DocumentEngine(JSON.stringify({ values, after: 900 }));
          for (let i = 0; i < values.length; i++) {
            d.mutate(
              {
                action: "replace",
                path: ["values", i],
                raw: JSON.stringify(newValue),
              },
              d.revision,
            );
            expect(d.raw(["after"])).toBe("900");
          }
          expect(JSON.parse(d.raw(["values"]))).toEqual(
            values.map(() => newValue),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
  it("save of an earlier snapshot leaves newer changes dirty", () => {
    const d = new DocumentEngine("1");
    d.source("2", 0);
    const saved = d.text;
    d.source("3", 1);
    d.markSaved(saved);
    expect(d.project(q).dirty).toBe(true);
    d.undo();
    expect(d.project(q).dirty).toBe(false);
  });
  it("limits excessive nesting before recursive parsing", () => {
    expect(
      () => new DocumentEngine("[".repeat(257) + "0" + "]".repeat(257)),
    ).toThrow(/nesting/);
  });
  it("round trips generated documents after replacement and undo", () => {
    fc.assert(
      fc.property(fc.jsonValue(), fc.jsonValue(), (initial, value) => {
        const text = JSON.stringify(initial, null, 2) + "\n";
        const d = new DocumentEngine(text);
        d.mutate(
          { action: "replace", path: [], raw: JSON.stringify(value) },
          0,
        );
        expect(d.diagnostics).toEqual([]);
        d.undo();
        expect(d.text).toBe(text);
      }),
      { numRuns: 250 },
    );
  });
  it("sorts mixed types consistently and preserves equal-number order", () => {
    const d = new DocumentEngine('[{"v":2},{"v":"10"},{"v":10},{"v":null},{}]');
    const p = d.project({ ...q, sort: { column: 1, direction: "ASC" } });
    expect(p.rows.map((r) => r.cells[1].type)).toEqual([
      "missing",
      "null",
      "number",
      "number",
      "string",
    ]);
    expect(p.rows.map((r) => r.path[0])).toEqual([4, 3, 0, 2, 1]);
  });
  it("opens wide record collections in property mode without dropping keys", () => {
    const record = Object.fromEntries(
      Array.from({ length: 201 }, (_, i) => ["key" + i, i]),
    );
    const d = new DocumentEngine(JSON.stringify([record]));
    expect(d.project(q).headers).toEqual(["Index", "Type", "Value"]);
    expect(d.project({ ...q, path: [0], records: false }).total).toBe(201);
  });
  it("searches beyond truncated string previews", () => {
    const d = new DocumentEngine(
      JSON.stringify({ value: "a".repeat(300) + "needle" }),
    );
    expect(d.project({ ...q, search: "needle" }).matched).toBe(1);
  });
  it("compares large and tiny decimals exactly", () => {
    for (const [a, b] of [
      ["9007199254740992", "9007199254740993"],
      ["1e399", "1e400"],
      ["-1e400", "-1e399"],
      ["0", "1e-10000"],
      ["-0.001", "0"],
      ["0.123456789012345678901", "0.123456789012345678902"],
    ])
      expect(compareNumbers(a, b)).toBe(-1);
    expect(compareNumbers("-0", "0e400")).toBe(0);
    expect(compareNumbers("1.0", "10e-1")).toBe(0);
  });
});
