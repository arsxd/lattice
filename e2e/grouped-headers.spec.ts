import { test, expect, type Page } from "@playwright/test";
async function sample(page: Page, name: string) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore sample workspace", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Document sheets" })
    .getByRole("button", { name, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand nested data", exact: true })
    .click();
}
test("Books uses a merged details header and editable leaf subheaders", async ({
  page,
}) => {
  await sample(page, "books");
  const table = page.getByRole("table", { name: "books data", exact: true });
  const details = table
    .locator("thead th[scope=colgroup]")
    .filter({ hasText: "details" });
  await expect(details).toHaveAttribute("colspan", "4");
  await expect(
    table.locator("thead").getByRole("button", { name: "pages", exact: true }),
  ).toBeVisible();
  await expect(
    table
      .locator("thead")
      .getByRole("button", { name: "language", exact: true }),
  ).toBeVisible();
  await expect(
    table
      .locator("thead")
      .getByRole("button", { name: "details / pages", exact: true }),
  ).toHaveCount(0);
  const pages = table.locator('[data-r="0"][data-c="8"]');
  await expect(pages).toHaveText("160");
  await pages.dblclick();
  const input = page.getByRole("textbox", {
    name: "Edit books details / pages",
    exact: true,
  });
  await input.fill("161");
  await input.press("Enter");
  await expect(pages).toHaveText("161");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(pages).toHaveText("160");
  await table.screenshot({ path: "output/books-grouped-headers.png" });
});
test("Orders expands shipping fields rather than rejecting its array records", async ({
  page,
}) => {
  await sample(page, "orders");
  const table = page.getByRole("table", { name: "orders data", exact: true });
  await expect(table).toBeVisible();
  await expect(
    table.locator("thead th[scope=colgroup]").filter({ hasText: "shipping" }),
  ).toHaveAttribute("colspan", "2");
  await expect(
    table.getByRole("button", { name: "method", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await table.locator('[data-r="0"][data-c="5"]').dblclick();
  const input = page.getByRole("textbox", {
    name: "Edit orders shipping / method",
    exact: true,
  });
  await input.fill("Pickup");
  await input.press("Enter");
  await expect(table.locator('[data-r="0"][data-c="5"]')).toHaveText("Pickup");
});
