import { expect, test, type Page } from "@playwright/test";

async function openTable(page: Page) {
  await page.setViewportSize({ width: 1300, height: 760 });
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    });
    localStorage.setItem("lattice-show-index", "false");
  });
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open…", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "t.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify(
        Array.from({ length: 20 }, (_, i) => ({ name: `Item ${i}`, n: i })),
      ),
    ),
  });
  await page.getByRole("grid", { name: "JSON data table" }).waitFor();
}
const styles = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) =>
    els
      .filter((e) => e.getBoundingClientRect().width > 4)
      .map((e) => {
        const c = getComputedStyle(e);
        return {
          radius: c.borderTopLeftRadius,
          height: Math.round(e.getBoundingClientRect().height),
          opacity: c.opacity,
        };
      }),
  );

test("buttons share one corner radius across the toolbar, location bar and bottom bar", async ({
  page,
}) => {
  await openTable(page);
  const radii = new Set<string>();
  for (const selector of [
    ".toolbar button",
    ".location .view-mode button",
    ".pagination > button",
    ".pagination .table-actions > button",
    ".file-location > summary",
  ])
    for (const s of await styles(page, selector)) radii.add(s.radius);
  expect([...radii]).toEqual(["4px"]);
});

test("popup items share one height", async ({ page }) => {
  await openTable(page);
  await page.locator(".freeze-menu summary").click();
  const freeze = await styles(page, ".freeze-options button");
  await page.keyboard.press("Escape");
  await page
    .getByRole("gridcell", { name: "Item 1", exact: true })
    .click({ button: "right" });
  const context = await styles(page, ".sheet-menu button");
  const heights = new Set([...freeze, ...context].map((s) => s.height));
  expect(heights.size).toBe(1);
  expect([...heights][0]).toBe(28);
});

test("disabled controls share one opacity", async ({ page }) => {
  await openTable(page);
  const seen = new Set<string>();
  for (const selector of [
    ".toolbar button:disabled",
    ".location button:disabled",
    ".pagination button:disabled",
  ])
    for (const s of await styles(page, selector)) seen.add(s.opacity);
  expect(seen.size).toBeGreaterThan(0);
  expect(seen.size).toBe(1);
});

test("a selected column header looks selected all the way across, arrow included", async ({
  page,
}) => {
  await openTable(page);
  const header = page.locator('[role="columnheader"]').nth(1);
  const parts = () =>
    header.evaluate((h) => ({
      label: getComputedStyle(h.querySelector(".column-select")!).color,
      arrow: getComputedStyle(h.querySelector(".header-filter")!).color,
    }));
  const before = await parts();
  await header.locator(".column-select").click();
  const after = await parts();
  expect(after.label).not.toBe(before.label); // selection is shown
  expect(after.arrow).toBe(after.label); // ...on the arrow as well
});

test("the app starts in the light theme unless a theme was chosen", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" }); // an OS in dark mode
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "System theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("Review changes sits at the edge in Source, with no empty slot where Details was", async ({
  page,
}) => {
  await openTable(page);
  const review = page.getByRole("button", { name: "Review changes" });
  const gapToEdge = async () =>
    review.evaluate((button) => {
      const bar = button.parentElement!.getBoundingClientRect();
      const box = button.getBoundingClientRect();
      return Math.round(bar.right - box.right);
    });
  const table = await gapToEdge();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page.locator(".cm-content").waitFor();
  await expect(page.getByRole("button", { name: /Details/ })).toHaveCount(0);
  // In Source the button is the last item, so it ends where the bar ends.
  expect(await gapToEdge()).toBeLessThanOrEqual(table);
  expect(await gapToEdge()).toBeLessThanOrEqual(14);
});
