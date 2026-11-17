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
    .getByRole("checkbox", { name: "Show nested data", exact: true })
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
  await pages.click();
  await expect(page.getByLabel("Cell address", { exact: true })).toHaveText("I1");
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
test("nested checkbox keeps content-sized widths and compact sizing survives toggling", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore sample workspace", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Document sheets" })
    .getByRole("button", { name: "orders", exact: true })
    .click();
  const checkbox = page.getByRole("checkbox", {
    name: "Show nested data",
    exact: true,
  });
  await expect(checkbox).not.toBeChecked();
  const compact = page.getByRole("grid", { name: "JSON data table" });
  const heading = compact.getByRole("columnheader").filter({
    has: page.getByRole("button", {
      name: "Select column order_id",
      exact: true,
    }),
  });
  await expect
    .poll(async () => (await heading.boundingBox())!.width)
    .toBeGreaterThan(100);
  const initial = (await heading.boundingBox())!.width;
  const compactChevron = await heading.locator(".header-filter svg path").getAttribute("d");
  await checkbox.check();
  const table = page.getByRole("table", { name: "orders data", exact: true });
  const quantity = table.locator('[data-r="0"][data-c="2"]'),
    note = table.locator('[data-r="0"][data-c="7"]');
  await expect(table).toBeVisible();
  expect(await table.locator(".header-filter svg path").first().getAttribute("d")).toBe(compactChevron);
  await expect(table.locator(".select-all-corner")).toHaveCount(0);
  expect((await quantity.boundingBox())!.width).toBeLessThan(150);
  expect((await note.boundingBox())!.width).toBeGreaterThan(
    (await quantity.boundingBox())!.width,
  );
  const corner = table.getByRole("button", {
    name: "Select all orders",
    exact: true,
  });
  await expect(corner).toHaveCSS("border-top-width", "0px");
  await expect(corner).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(corner).toHaveCSS("box-shadow", "none");
  for (let i = 0; i < 3; i++) {
    await checkbox.uncheck();
    await expect(compact).toBeVisible();
    await expect
      .poll(async () =>
        Math.abs((await heading.boundingBox())!.width - initial),
      )
      .toBeLessThanOrEqual(1);
    await checkbox.check();
    await expect(table).toBeVisible();
  }
  await checkbox.uncheck();
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect
    .poll(async () => (await heading.boundingBox())!.width)
    .toBeGreaterThan(100);
  await checkbox.check();
  await expect(table).toBeVisible();
  await table.screenshot({ path: "output/orders-content-widths.png" });
});
test("expanded worksheet controls stay directly above the sheet tabs at different heights", async ({
  page,
}) => {
  await sample(page, "books");
  const section = page.getByRole("region", {
    name: "books expanded table",
    exact: true,
  });
  const toolbar = section.locator(".pagination");
  const tabs = page.getByRole("navigation", { name: "Document sheets" });
  for (const height of [1000, 720, 1100]) {
    await page.setViewportSize({ width: 1440, height });
    await expect
      .poll(async () => {
        const bar = (await toolbar.boundingBox())!,
          nav = (await tabs.boundingBox())!;
        return Math.abs(bar.y + bar.height - nav.y);
      })
      .toBeLessThanOrEqual(2);
    const grid = section.locator(".expanded-grid");
    await grid.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(
      section.getByRole("button", { name: "Add column", exact: true }),
    ).toBeVisible();
    await expect(
      section.getByRole("button", { name: "Wrap text", exact: true }),
    ).toBeVisible();
  }
});

test("sample collections show merged rows and columns in the same worksheet", async ({
  page,
}) => {
  await sample(page, "collections");
  const table = page.getByRole("table", {
    name: "collections data",
    exact: true,
  });
  await expect(table.locator('[data-r="0"][data-c="0"]')).toHaveText(
    "staff_picks",
  );
  await expect(table.locator('[data-r="0"][data-c="0"]')).toHaveAttribute(
    "rowspan",
    "3",
  );
  await expect(table.locator('[data-r="3"][data-c="0"]')).toHaveText(
    "discovery",
  );
  await expect(table.locator('[data-r="3"][data-c="0"]')).toHaveAttribute(
    "rowspan",
    "2",
  );
  await expect(
    table.locator('thead th[scope="colgroup"]').filter({ hasText: "details" }),
  ).toHaveAttribute("colspan", "4");
  await expect(table.locator("tbody tr")).toHaveCount(5);
  await table.screenshot({ path: "output/collections-merged.png" });
});
