/** Reproducible synthetic structure audit. Generated JSON and reports stay in output/. */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import {
  DocumentEngine,
  compareNumbers,
  type Path,
  type Cell,
} from "../src/document/engine";
import {
  expandedRows,
  type ExpandedCell,
} from "../src/document/editableGroups";
const directory = "output/nesting-audit";
mkdirSync(`${directory}/fixtures`, { recursive: true });
const seed = 0x20261118;
let state = seed;
function random() {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4294967296;
}
const integer = (n: number) => Math.floor(random() * n);
const object = (entries: [string, unknown][]) => Object.fromEntries(entries);
const deep = (n: number, value: unknown): unknown =>
  n ? { [`level_${n}`]: deep(n - 1, value) } : value;
type Fixture = {
  id: string;
  category: string;
  text: string;
  expectedInvalid?: boolean;
  focusPaths?: Path[];
};
const fixtures: Fixture[] = [];
function add(
  id: string,
  category: string,
  value: unknown,
  raw = false,
  expectedInvalid = false,
) {
  fixtures.push({
    id,
    category,
    text: raw ? String(value) : JSON.stringify(value, null, 2),
    expectedInvalid,
  });
}
add("root-null", "primitive", null);
add("root-number", "primitive", 42);
add("root-text", "primitive", "line one\nline two");
add("root-boolean", "primitive", true);
add("empty-object", "empty", {});
add("empty-array", "empty", []);
add("primitive-list", "primitive-array", [0, false, null, "", "hello", [1, 2]]);
add("flat-values", "flat-object", {
  name: "Example",
  count: 0,
  active: false,
  note: "",
  absent: null,
});
add(
  "shared-records",
  "record-array",
  Array.from({ length: 8 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    details: { pages: 20 + i, language: "en" },
    tags: ["a", "b"],
  })),
);
add("heterogeneous-records", "heterogeneous-array", [
  { id: 1, alpha: "a" },
  { id: 2, beta: 2, nested: { enabled: true } },
  { id: 3, gamma: null },
]);
add("keyed-records", "keyed-map", {
  first: { name: "One", details: { pages: 10, language: "en" } },
  second: { name: "Two", details: { pages: 20, language: "fr" } },
});
add("distinct-dictionaries", "dictionary", {
  first: { name: "One", attributes: { red: 1, blue: false } },
  second: { name: "Two", attributes: { green: "yes" } },
});
add("disjoint-record-keys", "dictionary", {
  first: { only_first: 1, another_first: 2 },
  second: { only_second: 3 },
});
add("two-dictionaries", "sibling-dictionaries", {
  a: { label: "A", rooms: { a1: 1, a2: 2 }, devices: { devA: true } },
  b: { label: "B", rooms: { b1: 3 }, devices: { devB: false } },
});
add(
  "partial-overlap",
  "sparse-overlap",
  object(
    Array.from({ length: 3 }, (_, i) => [
      `record_${i}`,
      {
        name: `Row ${i}`,
        attributes: {
          shared: true,
          ...object(
            Array.from({ length: 12 }, (_, k) => [`unique_${i}_${k}`, k]),
          ),
        },
      },
    ]),
  ),
);
add("deep-dictionaries", "deep-dictionary", {
  a: { name: "A", metadata: { settings: { a1: 1, a2: 2 } } },
  b: { name: "B", metadata: { settings: { b1: 3, b2: 4 } } },
});
add("child-arrays", "child-record-arrays", {
  parent: {
    metadata: { enabled: true },
    rows: [{ n: 1 }, {}],
    batches: [{ tag: "A" }, { tag: "B" }],
    labels: ["a", "b"],
  },
});
add("mixed-arrays", "mixed-array", [
  { id: 1, values: [1, { nested: true }, [], null] },
  { id: 2, values: [] },
]);
add("empty-and-missing", "empty-values", {
  a: { name: "A", dictionary: { x: null }, empty: {} },
  b: { name: "B", dictionary: { y: "" }, empty: [] },
  c: { name: "C", dictionary: {}, empty: null },
});
add(
  "special-keys",
  "key-escaping",
  object([
    [
      "a/b",
      {
        name: "A",
        data: object([
          ["~value", 1],
          ['quoted"key', "x"],
        ]),
      },
    ],
    [
      "മലയാളം",
      {
        name: "B",
        data: object([
          ["__proto__", false],
          ["", null],
        ]),
      },
    ],
  ]),
);
add("deep-chain", "depth", deep(24, { value: "end" }));
add("wide-unique", "wide-dictionary", {
  a: object(Array.from({ length: 101 }, (_, i) => [`a${i}`, i])),
  b: object(Array.from({ length: 101 }, (_, i) => [`b${i}`, i])),
});
add(
  "bounded-parents",
  "bounds",
  Array.from({ length: 101 }, (_, i) => ({ id: i, items: [{ n: i }] })),
);
add("bounded-columns", "bounds", [
  object(Array.from({ length: 210 }, (_, i) => [`field${i}`, i])),
]);
add("bounded-depth", "bounds", deep(257, 1), false, true);
add(
  "exact-numbers",
  "numeric-spelling",
  '{"a":{"id":9007199254740993,"value":1e400,"negative":-0},"b":{"id":9007199254740995,"value":0.123456789012345678901,"negative":0}}',
  true,
);
add(
  "large-record-array",
  "large-document",
  Array.from({ length: 3000 }, (_, i) => ({
    id: i,
    name: `Record ${i}`,
    details: { enabled: true, score: i % 100 },
    note: "synthetic ".repeat(24),
  })),
);
fixtures.push({
  id: "large-document-small-section",
  category: "large-document",
  text: JSON.stringify({
    noise: Array.from({ length: 6000 }, (_, i) => ({
      id: i,
      note: "synthetic ".repeat(32),
    })),
    smallSection: {
      a: { name: "A", properties: { first: 1 } },
      b: { name: "B", properties: { second: 2 } },
    },
  }),
  focusPaths: [["smallSection"]],
});
for (let i = 0; i < 48; i++) {
  const count = 2 + integer(4),
    kind = i % 6;
  let value: unknown;
  if (kind === 0)
    value = object(
      Array.from({ length: count }, (_, r) => [
        `record_${r}`,
        {
          name: `Item ${r}`,
          attributes: object(
            Array.from({ length: 1 + integer(5) }, (_, k) => [
              `id_${r}_${k}`,
              [null, false, integer(99), `text ${k}`][integer(4)],
            ]),
          ),
        },
      ]),
    );
  else if (kind === 1)
    value = Array.from({ length: count }, (_, r) => ({
      id: r,
      details: { score: integer(100), nested: { valid: !!integer(2) } },
      tags: Array.from({ length: integer(4) }, () => integer(10)),
    }));
  else if (kind === 2)
    value = object(
      Array.from({ length: count }, (_, r) => [
        `group_${r}`,
        {
          label: `G${r}`,
          rows: Array.from({ length: integer(4) }, (_, k) => ({
            id: k,
            score: integer(99),
          })),
          other: [{ active: !!integer(2) }],
          labels: [],
        },
      ]),
    );
  else if (kind === 3)
    value = object(
      Array.from({ length: count }, (_, r) => [
        `item_${r}`,
        {
          name: `Item ${r}`,
          metadata: deep(
            1 + integer(3),
            object(
              Array.from({ length: 1 + integer(5) }, (_, k) => [
                `key_${r}_${k}`,
                integer(999),
              ]),
            ),
          ),
        },
      ]),
    );
  else if (kind === 4)
    value = Array.from({ length: count }, (_, r) =>
      object(
        Array.from({ length: 1 + integer(5) }, (_, k) => [
          `${r % 2 ? "odd" : "even"}_${k}`,
          [null, [], {}, `value ${r}`, integer(99)][integer(5)],
        ]),
      ),
    );
  else
    value = {
      data: object(
        Array.from({ length: count }, (_, r) => [
          `record/${r}`,
          {
            name: `Line ${r}\ncontinued`,
            attributes: object([
              [`~${r}`, integer(50)],
              [`unique_${r}`, { enabled: !!integer(2) }],
            ]),
          },
        ]),
      ),
      flags: [true, null, ""],
      version: i,
    };
  add(
    `random-${String(i + 1).padStart(2, "0")}`,
    `random-family-${kind}`,
    value,
  );
}
function at(value: any, path: Path): any {
  for (const key of path) value = value[key];
  return value;
}
function containers(value: any, path: Path = [], result: Path[] = []): Path[] {
  if (value && typeof value === "object") {
    result.push(path);
    for (const [key, child] of Object.entries(value))
      containers(
        child,
        [...path, Array.isArray(value) ? Number(key) : key],
        result,
      );
  }
  return result;
}
function scalarPaths(value: any, path: Path = [], result: Path[] = []): Path[] {
  if (value === null || typeof value !== "object") result.push(path);
  else
    for (const [key, child] of Object.entries(value))
      scalarPaths(
        child,
        [...path, Array.isArray(value) ? Number(key) : key],
        result,
      );
  return result;
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}
const knownFallback =
  /expand|mapping|record|dictionary|dictionar|column|table|nested|cells/i;
const results: any[] = [];
let views = 0,
  expandedViews = 0,
  fallbacks = 0,
  mutations = 0;
for (const fixture of fixtures) {
  writeFileSync(
    `${directory}/fixtures/${fixture.id}.json`,
    fixture.text + "\n",
  );
  const start = performance.now(),
    result: any = {
      id: fixture.id,
      category: fixture.category,
      bytes: Buffer.byteLength(fixture.text),
      views: [],
      warnings: [],
      errors: [],
    };
  if (fixture.expectedInvalid) {
    try {
      new DocumentEngine(fixture.text);
      result.errors.push("Depth guard did not reject fixture");
    } catch (error) {
      result.expectedRejection =
        error instanceof Error ? error.message : String(error);
    }
    results.push(result);
    continue;
  }
  try {
    const engine = new DocumentEngine(fixture.text);
    assert(!engine.diagnostics.length, "Unexpected parse issue");
    const parsed = JSON.parse(fixture.text),
      paths = [
        [],
        ...(fixture.focusPaths ?? []),
        ...containers(parsed)
          .filter((p) => p.length)
          .slice(0, 39),
      ];
    let writable: Cell | undefined;
    for (const path of paths) {
      const query = { path, records: true, search: "", page: 0 };
      const regular = engine.project(query);
      views++;
      assert(!regular.diagnostics.length, "Regular projection diagnostics");
      assert(
        regular.rows.every(
          (row) => row.cells.length === regular.headers.length,
        ),
        "Ragged regular table",
      );
      const eligible = regular.rows.some((row) =>
        row.cells.some(
          (c, i) => regular.columnKinds[i] !== "index" && c.container,
        ),
      );
      let record: any = {
        path,
        regularRows: regular.total,
        regularColumns: regular.headers.length,
        eligible,
      };
      for (const row of regular.rows)
        for (const c of row.cells)
          if (
            !writable &&
            !c.container &&
            c.type !== "missing" &&
            c.writable !== false &&
            !["array", "object"].includes(c.type)
          )
            writable = c;
      try {
        const expanded = engine.expanded(path);
        expandedViews++;
        const represented: { path: Path; container: boolean }[] = [];
        const scalar = scalarPaths(at(parsed, path), path);
        record.sections = expanded.sections.map((section) => {
          const width =
            section.parentHeaders.length + section.childHeaders.length;
          for (const group of section.groups) {
            assert(
              group.parent.length === section.parentHeaders.length,
              "Wrong parent width",
            );
            for (const row of group.children)
              assert(
                row.length === section.childHeaders.length,
                "Wrong child width",
              );
          }
          const rows = expandedRows(section, "", undefined, {}, compareNumbers);
          let slots = 0,
            filled = 0;
          for (const row of rows)
            for (const item of row.cells) {
              assert(item, "Undefined expanded cell");
              if (item.identifier === undefined && !item.layoutGap) {
                slots++;
                if (item.cell.type !== "missing") filled++;
              }
              if (item.cell.type !== "missing") {
                engine.raw(item.cell.path);
                if (item.identifier === undefined)
                  represented.push({
                    path: item.cell.path,
                    container:
                      item.cell.type === "array" || item.cell.type === "object",
                  });
              }
            }
          if (width >= 12 && slots && filled / slots < 0.5)
            result.warnings.push({
              path,
              section: section.key,
              issue: "sparse-expanded-layout",
              columns: width,
              filledFraction: Number((filled / slots).toFixed(3)),
            });
          const fingerprint = (rows: ReturnType<typeof expandedRows>) =>
            section.dictionaryBands
              ? [
                  ...new Set(
                    rows.flatMap((r) =>
                      r.cells
                        .filter((c) => c.cell.type !== "missing")
                        .map((c) =>
                          JSON.stringify([c.cell.path, c.identifier, c.value]),
                        ),
                    ),
                  ),
                ].sort()
              : rows
                  .map((r) =>
                    JSON.stringify(
                      r.cells.map((c) => [c.cell.path, c.identifier, c.value]),
                    ),
                  )
                  .sort();
          if (width && rows.length) {
            const sorted = expandedRows(
              section,
              "",
              { column: width - 1, direction: "DESC" },
              {},
              compareNumbers,
            );
            assert(
              JSON.stringify(fingerprint(rows)) ===
                JSON.stringify(fingerprint(sorted)),
              "Sort changed cell contents",
            );
            const first = rows
              .find((row) => !row.cells.at(-1)!.layoutGap)
              ?.cells.at(-1)!;
            const filtered = expandedRows(
              section,
              "",
              undefined,
              { [width - 1]: [first.cell.type + ":" + first.value] },
              compareNumbers,
            );
            assert(
              filtered.every((r) => {
                const c = r.cells[width - 1];
                return (
                  c.layoutGap ||
                  c.cell.type + ":" + c.value ===
                    first.cell.type + ":" + first.value
                );
              }),
              "Filter returned wrong values",
            );
          }
          return {
            key: section.key,
            rows: rows.length,
            columns: width,
            paired:
              section.columnPaths?.some(
                (p) => p.length > 1 && p.at(-1) === "Value",
              ) ?? false,
          };
        });
        const uncovered = scalar.filter(
          (leaf) =>
            !represented.some(
              (c) =>
                c.path.length <= leaf.length &&
                c.path.every((p, i) => p === leaf[i]) &&
                (c.path.length === leaf.length || c.container),
            ),
        );
        assert(
          !uncovered.length,
          `Expanded view lost scalar paths: ${JSON.stringify(uncovered.slice(0, 4))}`,
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        if (
          error instanceof TypeError ||
          error instanceof RangeError ||
          /lost scalar|Ragged|Undefined|Sort changed|Filter returned|Wrong /.test(
            reason,
          ) ||
          !knownFallback.test(reason)
        )
          throw error;
        record.fallback = reason;
        fallbacks++;
      }
      result.views.push(record);
      assert(engine.text === fixture.text, "Projection modified document");
    }
    if (writable) {
      const original = engine.raw(writable.path);
      const replacement =
        writable.type === "number"
          ? original === "42"
            ? "43"
            : "42"
          : writable.type === "boolean"
            ? original === "false"
              ? "true"
              : "false"
            : '"edited synthetic value"';
      engine.mutate(
        { action: "replace", path: writable.path, raw: replacement },
        engine.revision,
      );
      assert(
        engine.raw(writable.path) === replacement,
        "Edit did not reach expected path",
      );
      assert(engine.text !== fixture.text, "Edit was unexpectedly a no-op");
      const edited = engine.text;
      engine.undo();
      assert(engine.text === fixture.text, "Undo changed original spelling");
      engine.redo();
      assert(engine.text === edited, "Redo mismatch");
      engine.undo();
      mutations++;
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }
  result.elapsedMs = Number((performance.now() - start).toFixed(2));
  results.push(result);
}
const report = {
  seed,
  version: JSON.parse(readFileSync("package.json", "utf8")).version,
  generatedAt: new Date().toISOString(),
  scope:
    "Synthetic engine audit; layout sparsity is a heuristic, not proof of optimal UX. Native browser checks are separate.",
  fixtures: fixtures.length,
  regularViews: views,
  expandedAttemptsSucceeded: expandedViews,
  safeFallbacks: fallbacks,
  editUndoRedoChecks: mutations,
  failures: results.filter((r) => r.errors.length).length,
  layoutWarnings: results.flatMap((r) =>
    r.warnings.map((w: any) => ({ id: r.id, ...w })),
  ),
  results,
};
writeFileSync(
  `${directory}/engine-report.json`,
  JSON.stringify(report, null, 2) + "\n",
);
writeFileSync(
  `${directory}/manifest.json`,
  JSON.stringify(
    fixtures.map(({ text, ...meta }) => ({
      ...meta,
      file: `fixtures/${meta.id}.json`,
    })),
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    {
      fixtures: report.fixtures,
      regularViews: views,
      expandedViews,
      safeFallbacks: fallbacks,
      editUndoRedoChecks: mutations,
      failures: report.failures,
      layoutWarnings: report.layoutWarnings,
    },
    null,
    2,
  ),
);
if (report.failures) process.exitCode = 1;
