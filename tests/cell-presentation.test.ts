import { expect, it } from "vitest";
import { blankState, wrappedHeight } from "../src/grid/cellPresentation";
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
