import { it, expect } from "vitest";
import { sample } from "../src/sample";
import { DocumentEngine } from "../src/document/engine";
it("bundled workspace exposes real table and nested-navigation examples", () => {
  const d = new DocumentEngine(sample);
  const p = d.project({
    path: ["books"],
    records: true,
    search: "",
    page: 0,
  });
  expect(p.diagnostics).toEqual([]);
  expect(p.rows).toHaveLength(16);
  expect(p.headers).toContain("tags");
  expect(p.headers).toContain("details");
  expect(
    d.project({ path: ["orders"], records: true, search: "", page: 0 }).rows,
  ).toHaveLength(12);
});
it("bundled precision examples retain their exact tokens", () => {
  const d = new DocumentEngine(sample);
  expect(d.raw(["precision", "large_id"])).toBe("9007199254740993");
  expect(d.raw(["precision", "large_exponent"])).toBe("1e400");
  expect(d.raw(["precision", "negative_zero"])).toBe("-0");
});

it("example parameter groups expose expected tabs", async () => {
  const { readFileSync } = await import("node:fs");
  const text = readFileSync(
    new URL("../examples/03-application-settings.json", import.meta.url),
    "utf8",
  );
  const d = new DocumentEngine(text);
  expect(
    d
      .project({ path: [], records: true, search: "", page: 0 })
      .sheets?.map((s) => s.label),
  ).toEqual(["appearance", "notifications", "environments"]);
});
it("all downloadable examples parse without diagnostics", async () => {
  const { readFileSync } = await import("node:fs");
  for (const name of [
    "01-bookshop-workspace.json",
    "02-store-orders.json",
    "03-application-settings.json",
    "04-json-value-shapes.json",
    "review/before.json",
    "review/after.json",
  ]) {
    const d = new DocumentEngine(
      readFileSync(new URL("../examples/" + name, import.meta.url), "utf8"),
    );
    expect(d.diagnostics, name).toEqual([]);
  }
});
