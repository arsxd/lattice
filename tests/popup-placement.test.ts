import { expect, it } from "vitest";
import { placeAtPoint } from "../src/grid/popupPlacement";
const view = { width: 1000, height: 600 };
it("opens down and right of the pointer when there is room", () => {
  expect(
    placeAtPoint({ x: 100, y: 100 }, { width: 190, height: 200 }, view),
  ).toEqual({
    left: 100,
    top: 100,
    maxHeight: 492,
  });
});
it("opens upward from the pointer when it does not fit below but fits above", () => {
  const p = placeAtPoint({ x: 100, y: 500 }, { width: 190, height: 300 }, view);
  expect(p.top).toBeUndefined();
  expect(p.bottom).toBe(100); // the menu's bottom edge sits at the pointer
  expect(p.maxHeight).toBe(492);
});
it("uses the larger side and scrolls when neither side fits", () => {
  const below = placeAtPoint(
    { x: 100, y: 200 },
    { width: 190, height: 580 },
    view,
  );
  expect(below.top).toBe(200);
  expect(below.maxHeight).toBe(392);
  const above = placeAtPoint(
    { x: 100, y: 420 },
    { width: 190, height: 580 },
    view,
  );
  expect(above.bottom).toBe(180);
  expect(above.maxHeight).toBe(412);
});
it("keeps the menu inside the window horizontally", () => {
  expect(
    placeAtPoint({ x: 950, y: 100 }, { width: 190, height: 100 }, view).left,
  ).toBe(802);
  expect(
    placeAtPoint({ x: 2, y: 100 }, { width: 190, height: 100 }, view).left,
  ).toBe(8);
});
it("never returns a box that leaves the window", () => {
  for (let x = 0; x <= 1000; x += 97)
    for (let y = 0; y <= 600; y += 53)
      for (const h of [60, 250, 400, 700]) {
        const p = placeAtPoint({ x, y }, { width: 190, height: h }, view);
        const height = Math.min(h, p.maxHeight);
        const top = p.top ?? view.height - p.bottom! - height;
        expect(p.left).toBeGreaterThanOrEqual(8);
        expect(p.left + 190).toBeLessThanOrEqual(view.width - 8 + 0.001);
        expect(top).toBeGreaterThanOrEqual(8 - 0.001);
        expect(top + height).toBeLessThanOrEqual(view.height - 8 + 0.001);
      }
});
