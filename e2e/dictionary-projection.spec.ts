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
  await table.locator('[data-r="0"][data-c="2"]').click();
  await expect(page.getByLabel("Cell address", { exact: true })).toHaveText(
    "C1",
  );
  await expect(page.getByLabel("Selected key", { exact: true })).toHaveText(
    "alpha",
  );
  await expect(page.locator(".value-bar")).not.toContainText("Select a cell");
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

test("sibling dictionaries share one editable sheet with independent sorting and filtering", async ({
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
    name: "siblings.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      '{"a":{"label":"A","rooms":{"a2":2,"a1":1},"devices":{"devA":true}},"b":{"label":"B","rooms":{"b1":3},"devices":{"devB":false}}}',
    ),
  });
  await page.getByRole("checkbox", { name: "Show nested data" }).check();
  const table = page.getByRole("table", { name: "Data data", exact: true });
  await expect(page.locator(".expanded-sheets table")).toHaveCount(1);
  await expect(table.locator('th[scope="colgroup"]')).toHaveCount(2);
  await expect(table.locator('[data-r="0"][data-c="4"]')).toHaveAttribute(
    "rowspan",
    "2",
  );
  await page.screenshot({
    path: "output/parallel-dictionaries-unfiltered.png",
  });
  await table.locator('[data-r="1"][data-c="3"]').focus();
  await page.keyboard.press("Tab");
  await expect(table.locator('[data-r="2"][data-c="4"]')).toBeFocused();
  await table
    .getByRole("button", {
      name: "Sort and filter Data rooms / Key",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Other dictionaries stay visible",
  );
  await page
    .getByRole("button", { name: "Sort ascending ↑", exact: true })
    .click();
  await expect(table.locator('[data-r="0"][data-c="2"]')).toHaveText("a1");
  await table
    .getByRole("button", { name: "Sort and filter Data label", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sort descending ↓", exact: true })
    .click();
  await expect(table.locator('[data-r="0"][data-c="0"]')).toHaveText("b");
  await expect(table.locator('[data-r="2"][data-c="2"]')).toHaveText("a1");
  await table
    .getByRole("button", {
      name: "Sort and filter Data devices / Value",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Deselect shown", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "false", exact: true }).check();
  await page.getByRole("button", { name: "Apply filter", exact: true }).click();
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(table.locator('[data-r="0"][data-c="2"]')).toHaveText("b1");
  await table.locator('[data-r="0"][data-c="3"]').dblclick();
  const edit = page.getByRole("textbox", {
    name: "Edit Data rooms / Value",
    exact: true,
  });
  await edit.fill("42");
  await edit.press("Enter");
  await expect(table.locator('[data-r="0"][data-c="3"]')).toHaveText("42");
  await expect(page.locator(".status")).not.toContainText("Working…");
  await page.screenshot({ path: "output/parallel-dictionaries.png" });
});

test("equal length sibling dictionaries never imply row relationships", async ({
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
    name: "independent-dictionaries.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      '{"a":{"label":"A","rooms":{"a1":1,"a2":2},"devices":{"devA":true,"devC":false}},"b":{"label":"B","rooms":{"b1":3},"devices":{"devB":false}}}',
    ),
  });
  await page.getByRole("checkbox", { name: "Show nested data" }).check();
  const table = page.getByRole("table", { name: "Data data", exact: true });
  await expect(table.locator("tbody tr")).toHaveCount(6);
  await expect(table.locator('[data-r="1"][data-c="2"]')).toHaveText("a2");
  await expect(table.locator('[data-r="3"][data-c="4"]')).toHaveText("devC");
  for (const row of await table.locator("tbody tr").all()) {
    expect(
      await row
        .locator(
          'td:not([aria-hidden="true"])[data-c="2"], td:not([aria-hidden="true"])[data-c="4"]',
        )
        .count(),
    ).toBe(1);
  }
  await table.locator('[data-r="2"][data-c="4"]').focus();
  await page.keyboard.press("ArrowLeft");
  await expect(table.locator('[data-r="0"][data-c="1"]')).toBeFocused();
  await table.locator('[data-r="1"][data-c="3"]').focus();
  await page.keyboard.press("Tab");
  await expect(table.locator('[data-r="2"][data-c="4"]')).toBeFocused();
  await table.locator('[data-r="3"][data-c="5"]').dblclick();
  const edit = page.getByRole("textbox", {
    name: "Edit Data devices / Value",
    exact: true,
  });
  await edit.fill("true");
  await edit.press("Enter");
  await expect(table.locator('[data-r="3"][data-c="5"]')).toHaveText("true");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(table.locator('[data-r="3"][data-c="5"]')).toHaveText("false");
  await expect(page.locator(".status")).not.toContainText("Working…");
  await page.screenshot({ path: "output/independent-dictionary-blocks.png" });
});
