import { expect, it } from "vitest";
import { DocumentEngine } from "../src/document/engine";
import { contentColumnWidths } from "../src/grid/columnSizing";
const view = (text: string, records = false) =>
  new DocumentEngine(text).project({ path: [], records, search: "", page: 0 });
const measure = (text: string) => text.length * 8;
it("keeps property values content-sized instead of filling the window", () => {
  const projection = view('{"a very long property name": "value"}');
  const widths = contentColumnWidths(projection, 644, measure);
  expect(widths[0]).toBeGreaterThan(widths[1]);
  expect(Math.max(...widths)).toBeLessThanOrEqual(280);
  expect(widths.reduce((a, b) => a + b, 0)).toBeLessThan(600);
  expect(contentColumnWidths(projection, 2000, measure)).toEqual(widths);
});
it("keeps primitive-array values compact beside their fixed index", () => {
  const widths = contentColumnWidths(view("[100,200,300]"), 2000, measure);
  expect(widths[0]).toBe(88);
  expect(widths[1]).toBeLessThanOrEqual(280);
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
it("sizes a single column from content and handles empty projections", () => {
  expect(
    contentColumnWidths(
      { headers: ["Value"], columnKinds: ["value"], rows: [] },
      644,
      measure,
    ),
  ).toEqual([96]);
  expect(
    contentColumnWidths(
      { headers: [], columnKinds: [], rows: [] },
      644,
      measure,
    ),
  ).toEqual([]);
});

it("measures numbers using the tabular digit advance", () => {
  const measured: string[] = [];
  contentColumnWidths(view("[11111111111]"), 2000, (text) => {
    measured.push(text);
    return measure(text);
  });
  expect(measured).toContain("00000000000");
  expect(measured).not.toContain("11111111111");
});
