import { test, expect } from "@playwright/test";
test("unique dictionary keys use editable Key/Value subcolumns with stable selection", async ({
  page,
}) => {
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
    name: "dictionary.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      '{"first":{"name":"A","attributes":{"alpha":9007199254740993,"beta":true}},"second":{"name":"B","attributes":{"gamma":"three"}}}',
    ),
  });
  await page.getByRole("checkbox", { name: "Show nested data" }).check();
  const table = page.getByRole("table", {
    name: "attributes data",
    exact: true,
  });
  await expect(
    table.locator('th[scope="colgroup"]').filter({ hasText: "attributes" }),
  ).toHaveAttribute("colspan", "2");
  await expect(table.locator('thead th[scope="col"]')).toHaveCount(4);
  await expect(table.locator('[data-r="0"][data-c="0"]')).toHaveAttribute(
    "rowspan",
    "2",
  );
  await expect(page.locator(".status .selection-status")).toContainText(
    "3 rows · 4 columns",
  );
  const value = table.locator('[data-r="0"][data-c="3"]');
  await value.click();
  const bar = page.getByRole("textbox", { name: "Selected cell value" });
  await expect(bar).toHaveValue("9007199254740993");
  await bar.fill("12");
  await bar.press("Enter");
  await expect(value).toHaveText("12");
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await expect(value).toHaveClass(/expanded-active-cell/);
  await expect(table.locator('[data-r="0"][data-c="2"]')).not.toHaveClass(
    /expanded-active-cell/,
  );
  await table.locator('[data-r="0"][data-c="2"]').dblclick();
  const key = page.getByRole("textbox", {
    name: "Edit attributes attributes / Key",
    exact: true,
  });
  await key.fill("renamed");
  await expect(key).toHaveValue("renamed");
  await key.press("Enter");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(table.locator('[data-r="0"][data-c="2"]')).toHaveText("renamed");
  await expect(value).toHaveText("12");
  await page.screenshot({ path: "output/dictionary-key-value.png" });
});
test("deep sparse dictionary entries stay editable at their exact source paths", async ({
  page,
}) => {
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
    name: "deep.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      '{"a":{"name":"A","metadata":{"settings":{"a1":1,"a2":2}}},"b":{"name":"B","metadata":{"other":{"b1":3}}}}',
    ),
  });
  await page.getByRole("checkbox", { name: "Show nested data" }).check();
  const table = page.getByRole("table", { name: "metadata data", exact: true });
  await expect(table.locator('thead th[scope="col"]')).toHaveCount(4);
  await expect(table.locator('[data-r="0"][data-c="2"]')).toHaveText(
    "settings / a1",
  );
  await table.locator('[data-r="0"][data-c="3"]').click();
  const bar = page.getByRole("textbox", { name: "Selected cell value" });
  await bar.fill("88");
  await bar.press("Enter");
  await expect(table.locator('[data-r="0"][data-c="3"]')).toHaveText("88");
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "JSON source draft" }),
  ).toContainText(/"a1"\s*:\s*88/);
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(table.locator('[data-r="0"][data-c="3"]')).toHaveText("1");
});
