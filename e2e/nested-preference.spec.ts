import { test, expect, type Page } from "@playwright/test";
async function open(page: Page, text: string, name: string) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open…", exact: true }).click();
  await (
    await chooser
  ).setFiles({ name, mimeType: "application/json", buffer: Buffer.from(text) });
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/");
});
test("reading lists expand safely and preference follows sheets and survives reload", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  const tabs = page.getByRole("navigation", { name: "Document sheets" });
  await tabs
    .getByRole("button", { name: "reading_lists", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "Show nested data" }).check();
  const table = page.getByRole("table", {
    name: "reading_lists data",
    exact: true,
  });
  await expect(table).toBeVisible();
  await expect(table.locator('[data-r="0"][data-c="2"]')).toContainText(
    "BK-001",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await tabs.getByRole("button", { name: "books", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Show nested data" }),
  ).toBeChecked();
  await expect(page.getByRole("table", { name: "books data" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page
    .getByRole("navigation", { name: "Document sheets" })
    .getByRole("button", { name: "reading_lists", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Show nested data" }),
  ).toBeChecked();
  await expect(
    page.getByRole("table", { name: "reading_lists data" }),
  ).toBeVisible();
});
test("unsupported sections fall back without losing the preference for other files", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.getByRole("checkbox", { name: "Show nested data" }).check();
  await open(page, "42", "plain.json");
  await expect(
    page.getByRole("grid", { name: "JSON data table" }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Show nested data" }),
  ).toBeChecked();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await open(page, '[{"name":"A","nested":{"value":1}}]', "nested.json");
  await expect(page.getByRole("table", { name: "Data data" })).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Show nested data" }),
  ).toBeChecked();
  await page.getByRole("tab", { name: "plain.json", exact: true }).click();
  await expect(
    page.getByRole("grid", { name: "JSON data table" }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Show nested data" }),
  ).toBeChecked();
});
test("file dragging uses a quiet outline and dismisses on Escape", async ({
  page,
}) => {
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(new File(["{}"], "a.json"));
    data.items.add(new File(["{}"], "b.json"));
    document
      .querySelector(".app-shell")!
      .dispatchEvent(
        new DragEvent("dragenter", {
          bubbles: true,
          cancelable: true,
          dataTransfer: data,
        }),
      );
  });
  const overlay = page.locator(".file-drop-overlay");
  await expect(overlay).toContainText("Drop 2 files to open");
  await expect(overlay).toHaveCSS("border-top-style", "solid");
  await expect(overlay).toHaveCSS("align-items", "center");
  await page.screenshot({ path: "output/file-drop-feedback.png" });
  await page.keyboard.press("Escape");
  await expect(overlay).toHaveCount(0);
});

test("flat name mappings stay vertical with nested preference enabled", async ({ page }) => {
  await open(page, JSON.stringify({ areaNames: { "101": "Balcony", "102": "Stage" }, records: [{ name: "A", details: { count: 1 } }] }), "catalog.json");
  const toggle = page.getByRole("checkbox", { name: "Show nested data" });
  await toggle.check();
  const tabs = page.getByRole("navigation", { name: "Document sheets" });
  await tabs.getByRole("button", { name: "areaNames", exact: true }).click();
  await expect(toggle).toBeChecked();
  const grid = page.getByRole("grid", { name: "JSON data table" });
  await expect(grid).toBeVisible();
  await expect(grid.getByRole("columnheader", { name: /Value/ })).toBeVisible();
  await expect(grid.getByRole("gridcell", { name: "Balcony", exact: true })).toBeVisible();
  await toggle.uncheck();
  await expect(toggle).toBeVisible();
  await toggle.check();
  await expect(grid).toBeVisible();
  await tabs.getByRole("button", { name: "All data", exact: true }).click();
  await expect(page.locator(".notice-toast")).toHaveCount(0);
});

test("bounded nested sheets explain fallback in a nonoverlapping alert", async ({ page }) => {
  await page.clock.install();
  await open(page, JSON.stringify({ performances: Array.from({ length: 243 }, (_, id) => ({ id, prices: [{ amount: 10 }], seatCategories: [{ name: "Standard" }] })) }), "catalog.json");
  await page.getByRole("navigation", { name: "Document sheets" }).getByRole("button", { name: "performances", exact: true }).click();
  await page.getByRole("checkbox", { name: "Show nested data" }).check();
  await expect(page.getByRole("grid", { name: "JSON data table" })).toBeVisible();
  const icon = page.getByRole("button", { name: "Why nested data is unavailable" });
  await expect(icon).toBeVisible();
  await expect(page.locator(".nested-warning")).toHaveCount(0);
  await page.clock.fastForward(6000);
  await expect(page.locator(".nested-warning")).toHaveCount(0);
  await expect(icon).toHaveCSS("border-top-width", "0px");
  await icon.hover();
  await expect(page.locator(".nested-warning")).toContainText("100 parent records");
  await expect(page.locator(".nested-warning")).toHaveCSS("text-align", "right");
  await page.mouse.move(0, 0);
  await expect(page.locator(".nested-warning")).toHaveCount(0);
  await icon.click();
  await page.mouse.move(0, 0);
  await expect(page.locator(".nested-warning")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".nested-warning")).toHaveCount(0);
  const tabs = page.getByRole("navigation", { name: "Document sheets" });
  await tabs.getByRole("button", { name: "All data", exact: true }).click();
  await tabs.getByRole("button", { name: "performances", exact: true }).click();
  await expect(icon).toBeVisible();
  await expect(page.locator(".nested-warning")).toHaveCount(0);
  await icon.hover();
  await page.screenshot({ path: "output/nested-fallback-alert.png" });
  await expect(page.locator(".notice-toast")).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Show nested data" }).uncheck();
  await expect(page.locator(".nested-warning")).toHaveCount(0);
});
