import { expect, test, type Page } from "@playwright/test";

async function openRows(page: Page, rows: number) {
  await page.addInitScript(() =>
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
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
        Array.from({ length: rows }, (_, i) => ({ name: `Item ${i}` })),
      ),
    ),
  });
  await page.getByRole("grid", { name: "JSON data table" }).waitFor();
}

test("the column menu stays on the side where it opened while its list loads", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 600 });
  await openRows(page, 60);
  const button = page.getByRole("button", {
    name: "Sort and filter name",
    exact: true,
  });
  await button.click();
  const menu = page.locator(".column-menu");
  await expect(menu).toBeVisible();
  // Wait for the value list: the menu is at its full height only after this.
  await expect(menu.getByRole("checkbox").first()).toBeVisible();
  const [anchor, panel] = await Promise.all([
    button.boundingBox(),
    menu.boundingBox(),
  ]);
  expect(panel!.y).toBeGreaterThanOrEqual(anchor!.y + anchor!.height);
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(600);
});

test("a short window keeps the menu inside the screen", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 380 });
  await openRows(page, 60);
  await page
    .getByRole("button", { name: "Sort and filter name", exact: true })
    .click();
  const menu = page.locator(".column-menu");
  await expect(menu.getByRole("checkbox").first()).toBeVisible();
  const panel = await menu.boundingBox();
  expect(panel!.y).toBeGreaterThanOrEqual(0);
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(380);
});
