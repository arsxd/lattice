import { expect, it } from "vitest";
import {
  blankState,
  wrappedHeight,
  valueBarPresentation,
  jsonSelectionPreview,
  VALUE_BAR_PREVIEW_LIMIT,
  JSON_PREVIEW_LIMIT,
} from "../src/grid/cellPresentation";
import { DocumentEngine } from "../src/document/engine";
const measure = (text: string) => text.length * 7;
it("keeps short and blank rows compact and expands only overflowing text", () => {
  expect(
    wrappedHeight(
      [
        { text: "Short", width: 155 },
        { text: "", width: 80 },
      ],
      measure,
    ),
  ).toBe(28);
  expect(wrappedHeight([{ text: "x".repeat(20), width: 100 }], measure)).toBe(
    48,
  );
  expect(wrappedHeight([{ text: "x".repeat(20), width: 200 }], measure)).toBe(
    28,
  );
  expect(wrappedHeight([{ text: "one\ntwo", width: 155 }], measure)).toBe(48);
  expect(
    wrappedHeight([{ text: "one\r\ntwo\rthree\nfour", width: 155 }], measure),
  ).toBe(68);
  expect(
    wrappedHeight([{ text: "aaaaaaa aaaaaaa aaaaaaa", width: 100 }], measure),
  ).toBe(68);
});
it("describes blank states without treating zero, false or literal labels as empty", () => {
  const engine = new DocumentEngine(
    '[{"s":"","o":{},"a":[],"n":null,"v":0,"b":false,"label":"missing"},{}]',
  );
  const view = engine.project({ path: [], records: true, search: "", page: 0 });
  const cell = (row: number, key: string) =>
    view.rows[row].cells[view.headers.indexOf(key)];
  expect(["s", "o", "a", "n"].map((key) => blankState(cell(0, key)))).toEqual([
    "Empty text",
    "Empty object",
    "Empty array",
    "No value (null)",
  ]);
  expect(blankState(cell(1, "s"))).toBe("Property not set");
  expect(["v", "b", "label"].map((key) => blankState(cell(0, key)))).toEqual([
    null,
    null,
    null,
  ]);
  expect(engine.raw([0, "n"])).toBe("null");
});

it("keeps large container selections out of input/pre rendering without changing their full JSON", () => {
  const text = JSON.stringify({
    items: Array.from({ length: 5000 }, (_, i) => ({ id: i, value: "text" })),
  });
  const engine = new DocumentEngine(text);
  const view = engine.project({
    path: [],
    records: false,
    search: "",
    page: 0,
  });
  const cell = view.rows[0].cells[1];
  const raw = engine.raw(["items"]);
  const bar = valueBarPresentation(cell, raw);
  expect(bar).toEqual({ text: "Array · 5000", previewOnly: true });
  const preview = jsonSelectionPreview(raw);
  expect(preview.truncated).toBe(true);
  expect(preview.text).toHaveLength(JSON_PREVIEW_LIMIT);
  expect(JSON.parse(engine.raw(["items"]))).toHaveLength(5000);
  expect(engine.text).toBe(text);
});
it("marks oversized scalar previews read-only instead of exposing truncation as editable text", () => {
  const value = "x".repeat(VALUE_BAR_PREVIEW_LIMIT + 50);
  const result = valueBarPresentation(
    { path: [], type: "string", display: "x…", container: false },
    JSON.stringify(value),
  );
  expect(result.previewOnly).toBe(true);
  expect(result.text).toHaveLength(VALUE_BAR_PREVIEW_LIMIT + 1);
  expect(
    valueBarPresentation(
      { path: [], type: "number", display: "42", container: false },
      "42",
    ),
  ).toEqual({ text: "42", previewOnly: false });
});
it("compacts array formatting without changing string spaces or exact numbers", () => {
  const engine = new DocumentEngine('{"tags":[ 1,\n -0, 1e400, "a  b" ]}');
  const cell = engine.project({ path: [], records: false, search: "", page: 0 })
    .rows[0].cells[1];
  expect(cell.display).toBe('[1, -0, 1e400, "a  b"]');
  expect(valueBarPresentation(cell, engine.raw(["tags"]))).toEqual({
    text: '[1, -0, 1e400, "a  b"]',
    previewOnly: false,
  });
});
