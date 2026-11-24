import { expect, test, type Page } from "@playwright/test";

async function openRows(page: Page, size: { width: number; height: number }) {
  await page.setViewportSize(size);
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
    name: "rows.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify(
        Array.from({ length: 60 }, (_, i) => ({ name: `Item ${i}`, n: i })),
      ),
    ),
  });
  await page.getByRole("grid", { name: "JSON data table" }).waitFor();
}
const bodyCell = (page: Page, row: number, col: number) =>
  page
    .getByRole("grid", { name: "JSON data table" })
    .locator(
      `[role="row"][aria-rowindex="${row + 2}"] [role="gridcell"][aria-colindex="${col + 2}"]`,
    );
const box = (page: Page, selector: string) =>
  page.locator(selector).evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.left, y: r.top, right: r.right, bottom: r.bottom };
  });

test("the context menu stays in the window, in place, in a short window", async ({
  page,
}) => {
  await openRows(page, { width: 1000, height: 380 });
  await bodyCell(page, 2, 0).click({ button: "right" });
  const menu = page.locator(".sheet-menu");
  await expect(menu).toBeVisible();
  await page.waitForTimeout(300); // the short fade-in has finished
  const first = await box(page, ".sheet-menu");
  await page.waitForTimeout(600);
  const later = await box(page, ".sheet-menu");
  expect(later).toEqual(first); // it does not move after opening
  expect(first.y).toBeGreaterThanOrEqual(0);
  expect(first.bottom).toBeLessThanOrEqual(380);
  // Every item can be reached by scrolling the menu.
  const last = menu.getByRole("menuitem").last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
});

test("a context menu opened near the bottom grows upward from the pointer", async ({
  page,
}) => {
  await openRows(page, { width: 1000, height: 700 });
  const target = bodyCell(page, 14, 0);
  await target.scrollIntoViewIfNeeded();
  const at = await target.boundingBox();
  await page.mouse.click(at!.x + 20, at!.y + 10, { button: "right" });
  const menu = await box(page, ".sheet-menu");
  expect(menu.bottom).toBeLessThanOrEqual(700);
  expect(menu.y).toBeGreaterThanOrEqual(0);
});

test("popups share one corner radius, shadow and text size", async ({
  page,
}) => {
  await openRows(page, { width: 1100, height: 600 });
  const looks: Record<string, string> = {};
  const look = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((e) => {
        const c = getComputedStyle(e);
        return `${c.borderRadius}|${c.boxShadow}|${c.fontSize}`;
      });
  await bodyCell(page, 1, 0).click({ button: "right" });
  looks.context = await look(".sheet-menu");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Sort and filter name", exact: true })
    .click();
  await expect(page.locator(".column-menu")).toBeVisible();
  looks.column = await look(".column-menu");
  await page.keyboard.press("Escape");
  await page.mouse.click(700, 400);
  await page.locator(".freeze-menu summary").click();
  looks.freeze = await look(".freeze-options");
  expect(new Set(Object.values(looks)).size).toBe(1);
});
