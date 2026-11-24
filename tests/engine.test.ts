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
    expect(d.project(q).headers).toEqual(["Index", "Value"]);
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
it("projects incomplete recovery/source drafts without traversing partial property values", () => {
  for (const text of [
    '{"unfinished":',
    '{"outer":{"unfinished":',
    "[",
    "",
    '{"a":1,"b":',
  ]) {
    const engine = new DocumentEngine(text);
    expect(engine.project(q)).toMatchObject({
      rows: [],
      headers: [],
      sheets: [],
      diagnostics: expect.any(Array),
    });
    expect(engine.text).toBe(text);
  }
});
it("column value options ignore sort, filters and search", () => {
  const d = new DocumentEngine(
    '[{"s":"b","n":2},{"s":"a","n":1},{"s":"c","n":3}]',
  );
  const base = { path: [], records: true, search: "", page: 0 };
  const headers = d.project(base).headers;
  const s = headers.indexOf("s"),
    n = headers.indexOf("n");
  const plain = d.project({ ...base, optionsColumn: s }).filterOptions;
  const narrowed = d.project({
    ...base,
    search: "a",
    sort: { column: n, direction: "DESC" },
    valueFilters: { [String(s)]: [plain![0].key] },
    optionsColumn: s,
  }).filterOptions;
  expect(plain?.map((o) => o.label)).toEqual(["b", "a", "c"]);
  expect(narrowed).toEqual(plain);
});
it("reports which column names match Find without changing row matches", () => {
  const d = new DocumentEngine(
    '[{"price":1,"stock":2,"note":"price drop"},{"price":3,"stock":4,"note":"x"}]',
  );
  const base = { path: [], records: true, search: "", page: 0 };
  const headers = d.project(base).headers;
  const price = headers.indexOf("price");
  const hit = d.project({ ...base, search: "pri" });
  expect(hit.searchHeaderMatches).toEqual([price]);
  expect(hit.searchMatchCount).toBe(1);
  const wholeWord = d.project({
    ...base,
    search: "pric",
    searchWholeWord: true,
  });
  expect(wholeWord.searchHeaderMatches).toEqual([]);
  const caseSensitive = d.project({
    ...base,
    search: "PRICE",
    searchCaseSensitive: true,
  });
  expect(caseSensitive.searchHeaderMatches).toEqual([]);
  expect(d.project(base).searchHeaderMatches).toBeUndefined();
  const onlyHeader = d.project({ ...base, search: "stock" });
  expect(onlyHeader.searchHeaderMatches).toEqual([headers.indexOf("stock")]);
  expect(onlyHeader.matched).toBe(0);
});
it("shows more of long text only when asked and only within a size budget", () => {
  const long = "word ".repeat(300);
  const base = { path: [], records: true, search: "", page: 0 };
  const display = (d: DocumentEngine, extra = {}) => {
    const p = d.project({ ...base, ...extra });
    return p.rows[0].cells[p.headers.indexOf("note")].display;
  };
  const one = new DocumentEngine(JSON.stringify([{ note: long }]));
  expect(display(one).length).toBe(238);
  expect(display(one, { previewChars: 4096 })).toBe(long);
  const many = new DocumentEngine(
    JSON.stringify(
      Array.from({ length: 500 }, () => ({ note: long, other: 1 })),
    ),
  );
  const shown = display(many, { previewChars: 4096 }).length;
  expect(shown).toBeGreaterThanOrEqual(238);
  expect(shown).toBeLessThan(500);
});
it("finds text deep inside a large nested value", () => {
  const d = new DocumentEngine(
    JSON.stringify([
      { id: 1, obj: { pad: "y".repeat(6000), late: "NEEDLE" } },
      { id: 2, obj: { pad: "z".repeat(10) } },
    ]),
  );
  const found = d.project({
    path: [],
    records: true,
    search: "NEEDLE",
    page: 0,
  });
  expect(found.matched).toBe(1);
  expect(found.searchMatchCount).toBe(1);
});
it("shows the neighbourhood of a match that lies beyond the cell preview", () => {
  const note = "x".repeat(600) + " NEEDLE " + "y".repeat(600);
  const obj = { pad: "p".repeat(5000), late: "NEEDLE here" };
  const d = new DocumentEngine(JSON.stringify([{ note, obj }]));
  const base = { path: [], records: true, page: 0 };
  const shown = (search: string, name: string, data = d) => {
    const p = data.project({ ...base, search });
    return p.rows[0].cells[p.headers.indexOf(name)].display;
  };
  const noteDisplay = shown("NEEDLE", "note");
  expect(noteDisplay).toContain("NEEDLE");
  expect(noteDisplay.startsWith("…")).toBe(true);
  expect(noteDisplay.length).toBeLessThanOrEqual(240);
  const objDisplay = shown("NEEDLE", "obj");
  expect(objDisplay).toContain("NEEDLE");
  expect(objDisplay.length).toBeLessThanOrEqual(4096);
  // Without a search, or when the match is already visible, nothing changes.
  expect(shown("", "note").startsWith("xxx")).toBe(true);
  const near = new DocumentEngine(
    JSON.stringify([{ note: "abc NEEDLE " + "x".repeat(600) }]),
  );
  expect(shown("NEEDLE", "note", near)).toBe(shown("", "note", near));
});
it("selection returns the same cells as a full projection, without building the page", () => {
  const rows = Array.from({ length: 300 }, (_, i) => ({
    id: i,
    name: `Row ${i}`,
    payload: { deep: { list: [i, i + 1], text: "x".repeat(50) } },
  }));
  const d = new DocumentEngine(JSON.stringify(rows));
  const q = { path: [], records: true, search: "", page: 0 };
  const sel = {
    mode: "cells",
    anchor: { r: 2, c: 1 },
    end: { r: 4, c: 3 },
  } as const;
  const viaSelection = d.selection(q, sel, d.revision);
  expect(viaSelection).toEqual(d.project(q, sel).selectedCells);
  expect(viaSelection.length).toBe(3);
  // Sorted and filtered views index into the same ordering.
  const sorted = { ...q, sort: { column: 2, direction: "DESC" as const } };
  expect(d.selection(sorted, sel, d.revision)).toEqual(
    d.project(sorted, sel).selectedCells,
  );
  const searched = { ...q, search: "Row 1" };
  expect(d.selection(searched, sel, d.revision)).toEqual(
    d.project(searched, sel).selectedCells,
  );
});
it("never serves stale filtered or sorted rows after an edit, undo or query change", () => {
  const d = new DocumentEngine(
    JSON.stringify([
      { name: "delta", n: 4 },
      { name: "alpha", n: 1 },
      { name: "charlie", n: 3 },
      { name: "bravo", n: 2 },
    ]),
  );
  const base = { path: [], records: true, search: "", page: 0 };
  const col = d.project(base).headers.indexOf("name");
  const names = (q: object) =>
    d.project({ ...base, ...q }).rows.map((r) => r.cells[col].display);
  const asc = { sort: { column: col, direction: "ASC" as const } };
  expect(names(asc)).toEqual(["alpha", "bravo", "charlie", "delta"]);
  expect(names(asc)).toEqual(["alpha", "bravo", "charlie", "delta"]); // repeat: cached
  expect(names({ ...asc, sort: { column: col, direction: "DESC" } })).toEqual([
    "delta",
    "charlie",
    "bravo",
    "alpha",
  ]);
  expect(d.project({ ...base, search: "a" }).matched).toBe(4);
  expect(d.project({ ...base, search: "alp" }).matched).toBe(1);
  // An edit changes the order and the matches.
  const row = d
    .project(base)
    .rows.find((r) => r.cells[col].display === "delta")!;
  d.mutate(
    { action: "replace", path: [...row.path, "name"], raw: '"aaa"' },
    d.revision,
  );
  expect(names(asc)).toEqual(["aaa", "alpha", "bravo", "charlie"]);
  expect(d.project({ ...base, search: "alp" }).matched).toBe(1);
  expect(d.project({ ...base, search: "aaa" }).matched).toBe(1);
  d.undo();
  expect(names(asc)).toEqual(["alpha", "bravo", "charlie", "delta"]);
  expect(d.project({ ...base, search: "aaa" }).matched).toBe(0);
  // Result navigation picks the right match from the same cached search.
  const hits = [0, 1, 2].map(
    (i) => d.project({ ...base, search: "a", searchResult: i }).searchSelection,
  );
  expect(hits.every((h) => !!h)).toBe(true);
  expect(new Set(hits.map((h) => `${h!.row}:${h!.column}`)).size).toBe(3);
  expect(
    d.project({ ...base, search: "a", searchResult: 99 }).searchSelection,
  ).toBeUndefined();
  // Case and whole-word options are part of the key.
  expect(d.project({ ...base, search: "ALPHA" }).matched).toBe(1);
  expect(
    d.project({ ...base, search: "ALPHA", searchCaseSensitive: true }).matched,
  ).toBe(0);
  expect(
    d.project({ ...base, search: "alph", searchWholeWord: true }).matched,
  ).toBe(0);
  // Value filters.
  const options = d.project({ ...base, optionsColumn: col }).filterOptions!;
  const keep = options.find((o) => o.label === "bravo")!.key;
  expect(names({ valueFilters: { [col]: [keep] } })).toEqual(["bravo"]);
  expect(names({ valueFilters: { [col]: [keep] } })).toEqual(["bravo"]);
  expect(names({})).toHaveLength(4);
});
it("nested previews stay correct across edits when they are cached", () => {
  const d = new DocumentEngine(
    JSON.stringify([
      { id: 1, meta: { a: [1, 2, { b: "x" }], c: "keep" } },
      { id: 2, meta: { a: [], c: "other" } },
    ]),
  );
  const q = { path: [], records: true, search: "", page: 0 };
  const shown = () => {
    const p = d.project(q);
    return p.rows.map((r) => r.cells[p.headers.indexOf("meta")].display);
  };
  const before = shown();
  expect(before[0]).toBe('{"a": [1, 2, {"b": "x"}], "c": "keep"}');
  expect(shown()).toEqual(before); // repeated, cached
  d.mutate(
    { action: "replace", path: [0, "meta", "c"], raw: '"changed"' },
    d.revision,
  );
  expect(shown()[0]).toBe('{"a": [1, 2, {"b": "x"}], "c": "changed"}');
  expect(shown()[1]).toBe(before[1]);
  d.undo();
  expect(shown()).toEqual(before);
  // A different value at the same position after Source replaces the text.
  d.source(JSON.stringify([{ id: 9, meta: { z: 1 } }]), d.revision);
  expect(shown()).toEqual(['{"z": 1}']);
});
