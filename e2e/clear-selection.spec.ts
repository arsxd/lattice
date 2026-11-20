import { test, expect, type Page } from "@playwright/test";
async function open(page: Page) {
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
    name: "selection.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      '[{"name":"Alpha","price":12},{"name":"Beta","price":20}]',
    ),
  });
}
async function blank(page: Page) {
  const grid = page.getByRole("grid", { name: "JSON data table" });
  const box = await grid.boundingBox();
  await grid.click({ position: { x: box!.width - 15, y: box!.height - 15 } });
}
test("blank sheet clears cell and column selections but keeps value-bar editing usable", async ({
  page,
}) => {
  await open(page);
  const cell = page.getByRole("gridcell", { name: "Alpha", exact: true });
  await cell.click();
  const bar = page.getByRole("textbox", { name: "Selected cell value" });
  await expect(bar).toHaveValue('"Alpha"');
  await bar.click();
  await expect(bar).toHaveValue('"Alpha"');
  await blank(page);
  await expect(bar).toHaveCount(0);
  await expect(page.locator(".status")).not.toContainText("cells selected");
  await expect(page.locator(".data-grid")).toHaveCSS(
    "--rdg-selection-color",
    "transparent",
  );
  const header = page.getByRole("button", {
    name: "Select column name",
    exact: true,
  });
  await header.click();
  await expect(header).toHaveAttribute("aria-pressed", "true");
  await blank(page);
  await expect(header).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".status")).not.toContainText("cells selected");
  await cell.click();
  await expect(bar).toHaveValue('"Alpha"');
});
test("blank sheet commits valid inline input then clears selection", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("gridcell", { name: "Alpha", exact: true }).dblclick();
  const editor = page.locator(".inline-cell");
  await editor.fill("Changed");
  await blank(page);
  await expect(
    page.getByRole("gridcell", { name: "Changed", exact: true }),
  ).toBeVisible();
  await expect(editor).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Selected cell value" }),
  ).toHaveCount(0);
});
test("blank sheet preserves invalid inline input for correction", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("gridcell", { name: "12", exact: true }).dblclick();
  const editor = page.locator(".inline-cell");
  await editor.fill("invalid number");
  await blank(page);
  await expect(editor).toHaveValue("invalid number");
  await expect(editor).toHaveAttribute("aria-invalid", "true");
  await editor.press("Escape");
  await expect(
    page.getByRole("gridcell", { name: "12", exact: true }),
  ).toBeVisible();
});

test("blank sheet commits the value bar and preserves invalid value-bar drafts", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("gridcell", { name: "Alpha", exact: true }).click();
  const bar = page.getByRole("textbox", { name: "Selected cell value" });
  await bar.fill("Value bar edit");
  await blank(page);
  await expect(
    page.getByRole("gridcell", { name: "Value bar edit", exact: true }),
  ).toBeVisible();
  await expect(bar).toHaveCount(0);
  await page.getByRole("gridcell", { name: "12", exact: true }).click();
  await bar.fill("invalid");
  await blank(page);
  await expect(bar).toHaveValue("invalid");
  await expect(bar).toHaveAttribute("aria-invalid", "true");
  await bar.press("Escape");
  await blank(page);
  await expect(bar).toHaveCount(0);
  await expect(
    page.getByRole("gridcell", { name: "12", exact: true }),
  ).toBeVisible();
});
