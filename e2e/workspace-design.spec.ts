import { test, expect } from "@playwright/test";
test("redesigned workspace keeps the value bar visibly editable in both themes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  const cell = page.getByRole("gridcell", {
    name: "A Quiet Kitchen",
    exact: true,
  });
  await cell.click();
  const bar = page.getByRole("textbox", { name: "Selected cell value" });
  await expect(page.locator(".value-bar label")).toHaveText("Value");
  await expect(page.getByLabel("Cell address", { exact: true })).toHaveText(
    "B4",
  );
  await expect(bar).toBeEditable();
  const detailsIcon = page
    .getByRole("button", { name: "Toggle value inspector" })
    .locator("svg");
  await expect(detailsIcon).toHaveAttribute("viewBox", "0 0 24 24");
  await expect(detailsIcon.locator("rect")).toHaveAttribute("rx", "2");
  const browseIcon = page
    .getByRole("button", { name: "Browse", exact: true })
    .locator("svg");
  await expect(browseIcon).toHaveAttribute("viewBox", "0 0 24 24");
  await expect(browseIcon).toHaveAttribute("stroke-width", "1.6");
  expect(await browseIcon.locator("rect").evaluate((el) => el.outerHTML)).toBe(
    await detailsIcon.locator("rect").evaluate((el) => el.outerHTML),
  );
  await expect(browseIcon.locator("path")).toHaveAttribute("d", "M9 4v16");
  await expect(bar).toHaveCSS("border-top-width", "1px");
  await expect(page.getByRole("group", { name: "View mode" })).toBeVisible();
  await page.getByRole("button", { name: "Toggle value inspector" }).click();
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await page.screenshot({ path: "output/redesigned-workspace-light.png" });
  await bar.fill("Kitchen, revised");
  await bar.press("Enter");
  await expect(
    page.getByRole("gridcell", { name: "Kitchen, revised", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(cell).toBeVisible();
  await cell.click();
  await page
    .getByRole("combobox", { name: "Theme", exact: true })
    .selectOption("dark");
  await expect(bar).toBeEditable();
  await page.screenshot({ path: "output/redesigned-workspace-dark.png" });
  await bar.fill("Discard this");
  await bar.press("Escape");
  await expect(bar).toHaveValue("A Quiet Kitchen");
});
test("nested selection supplies a real address and distinguishes read-only previews", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.getByRole("checkbox", { name: "Show nested data" }).check();
  const table = page.getByRole("table", { name: "books data", exact: true });
  await table.locator('[data-r="0"][data-c="8"]').click();
  await expect(page.getByLabel("Cell address", { exact: true })).toHaveText(
    "I1",
  );
  const bar = page.getByRole("textbox", { name: "Selected cell value" });
  await expect(bar).toHaveValue("160");
  await expect(table.locator(".column-select small").nth(8)).toHaveText("I");
  await page.screenshot({ path: "output/redesigned-nested-workspace.png" });
  await bar.fill("161");
  await bar.press("Enter");
  await expect(table.locator('[data-r="0"][data-c="8"]')).toHaveText("161");
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await expect(page.getByLabel("Cell address", { exact: true })).toHaveText(
    "I1",
  );
  await page.getByRole("checkbox", { name: "Show nested data" }).uncheck();
  await page
    .getByRole("gridcell", { name: /edition: 1, pages: 161/ })
    .first()
    .click();
  await expect(page.locator(".value-bar label")).toHaveText("Preview");
  await expect(bar).not.toBeEditable();
});
