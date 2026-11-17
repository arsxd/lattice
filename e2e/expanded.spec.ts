import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { test, expect, type Page } from "@playwright/test";
const text =
  '[{"order":"B","items":[{"product":"Keyboard","qty":2},{"product":"Monitor","qty":1}],"shipments":[{"status":"Pending"}]},{"order":"A","items":[{"product":"Mouse","qty":3}],"shipments":[]}]';
async function open(page: Page, source = text, url = "/") {
  await page.addInitScript(() =>
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto(url);
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Open JSON file…", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "orders.json",
    mimeType: "application/json",
    buffer: Buffer.from(source),
  });
  await page
    .getByRole("button", { name: "Expand nested rows", exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: "items data", exact: true }),
  ).toBeVisible();
}
const table = (page: Page) =>
  page.getByRole("table", { name: "items data", exact: true });
const cell = (page: Page, r: number, c: number) =>
  table(page).locator(`[data-r="${r}"][data-c="${c}"]`);
test("expands automatically and edits shared parent and child values with existing undo", async ({
  page,
}) => {
  await open(page);
  await expect(cell(page, 0, 0)).toHaveAttribute("rowspan", "2");
  await expect(
    page.getByRole("table", { name: "shipments data", exact: true }),
  ).toBeVisible();
  await cell(page, 0, 0).dblclick();
  const parent = page.getByRole("textbox", {
    name: "Edit items order",
    exact: true,
  });
  await parent.fill("Changed");
  await parent.press("Enter");
  await expect(cell(page, 0, 0)).toHaveText("Changed");
  await expect(
    page
      .getByRole("table", { name: "shipments data" })
      .locator('[data-r="0"][data-c="0"]'),
  ).toHaveText("Changed");
  await cell(page, 1, 2).dblclick();
  const qty = page.getByRole("textbox", {
    name: "Edit items qty",
    exact: true,
  });
  await qty.fill("8");
  await qty.press("Tab");
  await expect(cell(page, 1, 2)).toHaveText("8");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(cell(page, 1, 2)).toHaveText("1");
  await expect(cell(page, 0, 0)).toHaveText("Changed");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(cell(page, 0, 0)).toHaveText("B");
});
test("supports typing, Escape, parent-safe filtering and Source/Details selection", async ({
  page,
}) => {
  await open(page);
  await cell(page, 0, 1).click();
  await cell(page, 0, 1).press("X");
  const input = page.getByRole("textbox", { name: "Edit items product" });
  await expect(input).toHaveValue("X");
  await input.press("Escape");
  await expect(cell(page, 0, 1)).toHaveText("Keyboard");
  await page
    .getByRole("searchbox", { name: "Find in items", exact: true })
    .fill("Monitor");
  await expect(table(page).locator("tbody tr")).toHaveCount(1);
  await expect(cell(page, 0, 0)).toHaveText("B");
  await cell(page, 0, 1).click();
  await page.getByRole("button", { name: "Toggle value inspector" }).click();
  await expect(page.locator(".inspector .path")).toHaveText(
    "/0/items/1/product",
  );
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "JSON source draft" }),
  ).toBeVisible();
  await expect(page.locator(".cm-selectionBackground").first()).toBeAttached();
});
test("sorts children within parents and rejects conflicting merged paste without changing the file", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: "Sort and filter items qty", exact: true })
    .click();
  await page.getByRole("button", { name: "Sort ascending ↑" }).click();
  await expect(cell(page, 0, 1)).toHaveText("Monitor");
  await expect(cell(page, 0, 0)).toHaveText("B");
  await cell(page, 0, 0).click();
  await cell(page, 0, 0).evaluate((el) => {
    const data = new DataTransfer();
    data.setData("text/plain", "First\nSecond");
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  });
  await expect(page.getByRole("alert")).toContainText("different values");
  await expect(cell(page, 0, 0)).toHaveText("B");
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
});
test("adds child rows and columns, infers null-cell types and copies/pastes a range", async ({
  page,
}) => {
  await open(page);
  const section = page.getByRole("region", {
    name: "items expanded table",
    exact: true,
  });
  await cell(page, 0, 0).click();
  await section.getByRole("button", { name: "Add row", exact: true }).click();
  await expect(table(page).locator("tbody tr")).toHaveCount(4);
  await expect(cell(page, 0, 0)).toHaveAttribute("rowspan", "3");
  await cell(page, 2, 2).dblclick();
  const input = page.getByRole("textbox", { name: "Edit items qty" });
  await input.fill("7");
  await input.press("Enter");
  await expect(cell(page, 2, 2)).toHaveText("7");
  await section
    .getByRole("button", { name: "Add column", exact: true })
    .click();
  await page.getByRole("textbox", { name: "New items column" }).fill("note");
  await section.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    table(page).getByRole("button", { name: "note", exact: true }),
  ).toBeVisible();
  await cell(page, 0, 2).click();
  await cell(page, 1, 2).click({ modifiers: ["Shift"] });
  const copied = () =>
    cell(page, 0, 2).evaluate((el) => {
      const data = new DataTransfer();
      el.dispatchEvent(
        new ClipboardEvent("copy", {
          bubbles: true,
          cancelable: true,
          clipboardData: data,
        }),
      );
      return data.getData("text/plain");
    });
  await expect.poll(copied).toBe("2\r\n1");
  await cell(page, 0, 2).evaluate((el) => {
    const data = new DataTransfer();
    data.setData("text/plain", "9\n10");
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  });
  await expect(cell(page, 0, 2)).toHaveText("9");
  await expect(cell(page, 1, 2)).toHaveText("10");
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "JSON source draft" }),
  ).toContainText(/"qty":\s*7/);
});
test("freezes complete merged groups and supports column resizing", async ({
  page,
}) => {
  await open(page);
  const section = page.getByRole("region", {
    name: "items expanded table",
    exact: true,
  });
  await section.locator(".freeze-menu summary").click();
  await section
    .getByRole("button", { name: "Freeze first row", exact: true })
    .click();
  await section.locator(".freeze-menu summary").click();
  await expect(section.locator(".freeze-options")).toContainText("2 rows");
  await section.locator(".freeze-menu summary").click();
  await expect(cell(page, 0, 0)).toHaveCSS("position", "sticky");
  const resize = page.getByRole("separator", {
    name: "Resize items product",
    exact: true,
  });
  const before = await cell(page, 0, 1).evaluate(
    (el) => el.getBoundingClientRect().width,
  );
  await resize.focus();
  await resize.press("ArrowRight");
  await expect
    .poll(() =>
      cell(page, 0, 1).evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBeGreaterThan(before);
  await page.screenshot({
    path: "output/expanded-editable.png",
    fullPage: true,
  });
});

test("retains expanded filter and selection when returning from Source and closes the context menu outside", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("searchbox", { name: "Find in items", exact: true })
    .fill("Monitor");
  await cell(page, 0, 1).click();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page.getByRole("textbox", { name: "JSON source draft" }).waitFor();
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await expect(
    page.getByRole("searchbox", { name: "Find in items", exact: true }),
  ).toHaveValue("Monitor");
  await expect(cell(page, 0, 1)).toHaveClass(/expanded-selected/);
  await cell(page, 0, 1).click({ button: "right" });
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByRole("heading", { name: "shipments", exact: true }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page
    .getByRole("table", { name: "shipments data" })
    .locator('[data-r="0"][data-c="1"]')
    .click();
  await expect(table(page).locator(".expanded-selected")).toHaveCount(0);
});
test("keeps an entire merged parent group fixed during scrolling", async ({
  page,
}) => {
  const data = JSON.parse(text);
  data[1].items = Array.from({ length: 30 }, (_, i) => ({
    product: "Item " + i,
    qty: i,
  }));
  await open(page, JSON.stringify(data));
  const section = page.getByRole("region", {
    name: "items expanded table",
    exact: true,
  });
  await section.locator(".freeze-menu summary").click();
  await section
    .getByRole("button", { name: "Freeze first row", exact: true })
    .click();
  const before = await cell(page, 0, 0).boundingBox();
  await section.locator(".expanded-grid").evaluate((el) => {
    el.scrollTop = 200;
  });
  await expect
    .poll(async () => Math.round((await cell(page, 0, 0).boundingBox())!.y))
    .toBe(Math.round(before!.y));
});

test("edits merged cells in the actual offline HTML with networking disabled", async ({
  page,
}) => {
  await page.context().setOffline(true);
  await open(
    page,
    text,
    pathToFileURL(resolve("output/Lattice-Offline.html")).href,
  );
  await cell(page, 0, 0).dblclick();
  const input = page.getByRole("textbox", { name: "Edit items order" });
  await input.fill("Offline edit");
  await input.press("Enter");
  await expect(cell(page, 0, 0)).toHaveText("Offline edit");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(cell(page, 0, 0)).toHaveText("B");
});
test("types complete text, skips merged cells with Tab and commits when another cell or Source is clicked", async ({
  page,
}) => {
  await open(page);
  await cell(page, 0, 1).click();
  await cell(page, 0, 1).press("C");
  await page.keyboard.type("edar");
  const input = page.getByRole("textbox", { name: "Edit items product" });
  await expect(input).toHaveValue("Cedar");
  await cell(page, 1, 1).click();
  await expect(cell(page, 0, 1)).toHaveText("Cedar");
  await expect(cell(page, 1, 1)).toBeFocused();
  await cell(page, 0, 2).click();
  await cell(page, 0, 2).press("Tab");
  await expect(cell(page, 1, 1)).toBeFocused();
  await cell(page, 1, 1).press("Shift+Tab");
  await expect(cell(page, 0, 2)).toBeFocused();
  await cell(page, 0, 0).dblclick();
  await page
    .getByRole("textbox", { name: "Edit items order" })
    .fill("Committed by click");
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "JSON source draft" }),
  ).toContainText("Committed by click");
});
