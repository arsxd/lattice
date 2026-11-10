import { it, expect } from "vitest";
import { sample } from "../src/sample";
import { DocumentEngine } from "../src/document/engine";
it("bundled workspace exposes real table and nested-navigation examples", () => {
  const d = new DocumentEngine(sample);
  const p = d.project({
    path: ["signals"],
    records: true,
    search: "",
    page: 0,
  });
  expect(p.diagnostics).toEqual([]);
  expect(p.rows).toHaveLength(8);
  expect(p.headers).toContain("limits");
  expect(p.headers).toContain("interface");
  expect(
    d.project({ path: ["interfaces"], records: true, search: "", page: 0 })
      .rows,
  ).toHaveLength(4);
});
it("bundled precision examples retain their exact tokens", () => {
  const d = new DocumentEngine(sample);
  expect(d.raw(["precision", "large_id"])).toBe("9007199254740993");
  expect(d.raw(["precision", "large_exponent"])).toBe("1e400");
  expect(d.raw(["precision", "negative_zero"])).toBe("-0");
});
