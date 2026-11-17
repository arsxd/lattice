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
  await expect(overlay).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(overlay).toHaveCSS("border-top-style", "dashed");
  await page.screenshot({ path: "output/file-drop-feedback.png" });
  await page.keyboard.press("Escape");
  await expect(overlay).toHaveCount(0);
});
