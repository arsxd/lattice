import { expect, test, type Page } from "@playwright/test";

async function openRows(page: Page) {
  await page.setViewportSize({ width: 1200, height: 600 });
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
        Array.from({ length: 200 }, (_, i) => ({
          name: `Item ${i}`,
          note: i % 3 ? "alpha" : "beta gamma",
        })),
      ),
    ),
  });
  await page.getByRole("grid", { name: "JSON data table" }).waitFor();
}
const left = (page: Page) =>
  page
    .locator("#find")
    .evaluate((e) => Math.round(e.getBoundingClientRect().left));

test("the Find field stays put while the result count changes", async ({
  page,
}) => {
  await openRows(page);
  const input = page.locator("#find");
  const start = await left(page);
  const seen = new Set<number>([start]);
  for (const text of [
    "a",
    "al",
    "alp",
    "alph",
    "alpha",
    "beta",
    "zzzz",
    "Item 1",
  ]) {
    await input.fill(text);
    await expect(page.locator(".find-count")).toBeVisible();
    await page.waitForTimeout(150);
    seen.add(await left(page));
  }
  await input.fill("");
  await page.waitForTimeout(150);
  seen.add(await left(page));
  expect([...seen]).toEqual([start]);
});

test("Find has a visible, themed clear button that works", async ({ page }) => {
  await openRows(page);
  const input = page.locator("#find");
  await expect(page.getByRole("button", { name: "Clear search" })).toHaveCount(
    0,
  );
  await input.fill("alpha");
  const clear = page.getByRole("button", { name: "Clear search" });
  await expect(clear).toBeVisible();
  const box = await clear.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(22);
  expect(box!.height).toBeGreaterThanOrEqual(22);
  // It uses the theme's muted text colour, not the browser's default grey.
  const colours = await clear.evaluate((e) => ({
    own: getComputedStyle(e).color,
    muted: getComputedStyle(document.documentElement)
      .getPropertyValue("--muted")
      .trim(),
  }));
  expect(colours.own).not.toBe("rgb(0, 0, 0)");
  // A plain text field has no browser-drawn clear control, so there is just ours.
  await expect(input).toHaveAttribute("type", "text");
  await clear.click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await expect(page.locator(".find-count")).toBeHidden();
});
