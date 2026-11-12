import { expect, it } from "vitest";
import { frozenRowLayout } from "../src/grid/FrozenGrid";
const base = {
  rowHeights: [28, 60, 100],
  columnCount: 5,
  frozenCount: 2,
  headerHeight: 48,
  viewportHeight: 400,
};
it("computes sticky offsets from actual variable row heights", () => {
  expect(frozenRowLayout(base)).toMatchObject({
    allowed: true,
    offsets: [48, 76],
    frozenHeight: 88,
    enableVirtualization: false,
  });
});
it("keeps virtualization when no row freeze is requested", () => {
  expect(
    frozenRowLayout({
      ...base,
      frozenCount: 0,
      columnCount: 201,
      rowHeights: Array(500).fill(28),
    }),
  ).toMatchObject({ allowed: true, offsets: [], enableVirtualization: true });
});
it("bounds all rendered cells including the caller's gutter column", () => {
  expect(
    frozenRowLayout({
      ...base,
      columnCount: 20,
      rowHeights: Array(500).fill(28),
    }).allowed,
  ).toBe(true);
  expect(
    frozenRowLayout({
      ...base,
      columnCount: 21,
      rowHeights: Array(500).fill(28),
    }),
  ).toMatchObject({
    allowed: false,
    enableVirtualization: true,
    reason: expect.stringContaining("10,000"),
  });
});
it("rejects frozen rows occupying more than forty percent of viewport", () => {
  expect(frozenRowLayout({ ...base, viewportHeight: 200 })).toMatchObject({
    allowed: false,
    reason: expect.stringContaining("40%"),
  });
  expect(frozenRowLayout({ ...base, viewportHeight: 220 }).allowed).toBe(true);
});
it("rejects unavailable geometry and invalid row ranges", () => {
  for (const invalid of [
    { viewportHeight: 0 },
    { frozenCount: 4 },
    { frozenCount: -1 },
    { rowHeights: [28, NaN, 100] },
    { headerHeight: -1 },
  ]) {
    expect(frozenRowLayout({ ...base, ...invalid })).toMatchObject({
      allowed: false,
      enableVirtualization: true,
    });
  }
});
