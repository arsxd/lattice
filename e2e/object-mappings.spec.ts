import { test, expect, type Page } from "@playwright/test";
const text =
  '{"key1":{"key11":{"val1":1,"val2":2},"key12":{"val1":3,"val2":4}},"key2":{"key21":{"val1":5,"val2":6}}}';
async function open(page: Page) {
  await page.addInitScript(() =>
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Open JSON file…", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "mapping.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
}
test("expands the user-described object mapping into one editable worksheet", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: "Expand nested data", exact: true })
    .click();
  const table = page.getByRole("table", { name: "Data data", exact: true });
  await expect(table).toBeVisible();
  await expect(page.locator(".expanded-grid")).toHaveCount(1);
  await expect(table.locator('[data-r="0"][data-c="0"]')).toHaveText("key1");
  await expect(table.locator('[data-r="0"][data-c="0"]')).toHaveAttribute(
    "rowspan",
    "2",
  );
  const value = table.locator('[data-r="1"][data-c="2"]');
  await value.dblclick();
  const input = page.getByRole("textbox", {
    name: "Edit Data val1",
    exact: true,
  });
  await input.fill("30");
  await input.press("Enter");
  await expect(value).toHaveText("30");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(value).toHaveText("3");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: "output/nested-mapping.png", fullPage: true });
});
test("shows expansion inside key1 sheet and supports direct row-key renaming", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("navigation", { name: "Document sheets" })
    .getByRole("button", { name: "key1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand nested data", exact: true })
    .click();
  const table = page.getByRole("table", { name: "key1 data", exact: true });
  await expect(table).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await table.locator('[data-r="0"][data-c="0"]').dblclick();
  const key = page.getByRole("textbox", { name: "Edit key1 Key", exact: true });
  await key.fill("renamed");
  await key.press("Enter");
  await expect(table.locator('[data-r="0"][data-c="0"]')).toHaveText("renamed");
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "JSON source draft" }),
  ).toContainText("renamed");
});
