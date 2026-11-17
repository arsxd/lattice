import { it, expect, vi } from "vitest";
import { clampPaneWidth } from "../src/grid/PaneResizeHandle";
it("allows half-width Details while retaining the Browse cap and minimum widths", () => {
  vi.stubGlobal("window", { innerWidth: 1920 });
  try {
    expect(clampPaneWidth(2000, true)).toBe(960);
    expect(clampPaneWidth(2000, false)).toBe(520);
    expect(clampPaneWidth(50, true)).toBe(180);
    vi.stubGlobal("window", { innerWidth: 720 });
    expect(clampPaneWidth(960, true)).toBe(360);
  } finally {
    vi.unstubAllGlobals();
  }
});
