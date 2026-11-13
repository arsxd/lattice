import { expect, it } from "vitest";
import { DocumentEngine } from "../src/document/engine";
import { contentColumnWidths } from "../src/grid/columnSizing";
const view = (text: string, records = false) =>
  new DocumentEngine(text).project({ path: [], records, search: "", page: 0 });
const measure = (text: string) => text.length * 8;
it("fits property columns to the viewport and reserves room for values", () => {
  const widths = contentColumnWidths(
    view('{"a very long property name": "value"}'),
    644,
    measure,
  );
  expect(widths[0]).toBeLessThanOrEqual(270);
  expect(widths.reduce((a, b) => a + b, 0)).toBe(600);
  expect(widths[1]).toBeGreaterThan(widths[0]);
});
it("sizes uneven record fields from content with a fixed index", () => {
  const widths = contentColumnWidths(
    view('[{"a":"x","b":"a much longer value"}]', true),
    900,
    measure,
  );
  expect(widths[0]).toBe(88);
  expect(widths[2]).toBeGreaterThan(widths[1]);
});
it("caps wide tables and bounds measurements and sampled rows", () => {
  const projection = view(
    JSON.stringify(
      Array.from({ length: 80 }, () =>
        Object.fromEntries(
          Array.from({ length: 8 }, (_, i) => ["field" + i, "x".repeat(1000)]),
        ),
      ),
    ),
    true,
  );
  let calls = 0;
  const widths = contentColumnWidths(projection, 900, (text) => {
    calls++;
    expect(text.length).toBeLessThanOrEqual(240);
    return measure(text);
  });
  expect(Math.max(...widths)).toBeLessThanOrEqual(220);
  expect(calls).toBeLessThanOrEqual(projection.headers.length * 51);
});
it("fills a single column and handles empty projections", () => {
  expect(
    contentColumnWidths(
      { headers: ["Value"], columnKinds: ["value"], rows: [] },
      644,
      measure,
    ),
  ).toEqual([600]);
  expect(
    contentColumnWidths(
      { headers: [], columnKinds: [], rows: [] },
      644,
      measure,
    ),
  ).toEqual([]);
});
