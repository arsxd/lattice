import { expect, test, type Page } from "@playwright/test";
import packageInfo from "../package.json" with { type: "json" };
const version = packageInfo.version;
async function open(page: Page, text: string, name = "new-features.json") {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open…", exact: true }).click();
  await (
    await chooser
  ).setFiles({ name, mimeType: "application/json", buffer: Buffer.from(text) });
  await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
}
const grid = (page: Page) =>
  page.getByRole("grid", { name: "JSON data table" });
const cell = (page: Page, row: number, column: number) =>
  grid(page).locator(
    `[role="row"][aria-rowindex="${row + 2}"] [role="gridcell"][aria-colindex="${column + 2}"]`,
  );
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/");
});
test("shows the package version without clipping the narrow status bar", async ({
  page,
}) => {
  await expect(page.getByLabel("Lattice version")).toHaveText("v" + version);
  await open(page, '[{"name":"Alpha"}]');
  await page.setViewportSize({ width: 720, height: 500 });
  await expect(page.getByLabel("Lattice version")).toBeInViewport();
  expect(
    await page
      .locator(".status")
      .evaluate((e) => e.scrollWidth - e.clientWidth),
  ).toBeLessThanOrEqual(1);
});
test("explains an empty file and a missing value in human terms", async ({
  page,
}) => {
  await open(page, "", "empty.json");
  await expect(page.getByRole("alert")).toContainText(
    "This document is empty.",
  );
  await expect(
    page.getByRole("button", { name: "Open another file…" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "JSON source draft" }),
  ).toBeVisible();
  await open(page, '{"name": }', "missing.json");
  await expect(page.getByRole("alert")).toContainText(
    "A JSON value is missing.",
  );
  await expect(page.getByRole("alert")).toContainText("line 1, column");
});
test("opens dropped files as distinct documents and preserves the previous source draft", async ({
  page,
}) => {
  await open(page, '{"original":true}', "original.json");
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page
    .getByRole("textbox", { name: "JSON source draft" })
    .fill('{"unfinished":');
  await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(['{"first":1}'], "first.json", { type: "application/json" }),
    );
    transfer.items.add(
      new File(['{"second":2}'], "second.json", { type: "application/json" }),
    );
    document.querySelector(".app-shell")!.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
  });
  await expect(
    page.getByRole("tab", { name: "second.json", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "first.json", exact: true }).click();
  await expect(
    grid(page).getByRole("gridcell", { name: "first", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /^original.json/ }).click();
  await expect(
    page.getByRole("textbox", { name: "JSON source draft" }),
  ).toHaveText('{"unfinished":');
});
test("allows Details to expand to half a wide window and clamps after resizing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await open(page, '{"a":1}');
  await cell(page, 0, 1).click();
  await page.getByRole("button", { name: "Toggle value inspector" }).click();
  const handle = page.getByRole("separator", { name: "Resize Details pane" });
  const bounds = (await handle.boundingBox())!;
  await page.mouse.move(bounds.x + 2, bounds.y + 30);
  await page.mouse.down();
  await page.mouse.move(bounds.x - 700, bounds.y + 30, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page
        .locator(".inspector")
        .evaluate((e) => e.getBoundingClientRect().width),
    )
    .toBe(960);
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect
    .poll(() =>
      page
        .locator(".inspector")
        .evaluate((e) => e.getBoundingClientRect().width),
    )
    .toBeLessThanOrEqual(600);
});
test("hidden indices keep first-field editing, sort/filter and freeze tied to the right values", async ({
  page,
}) => {
  await open(page, '[{"name":"Zulu","index":91},{"name":"Alpha","index":92}]');
  await expect(
    page.getByRole("button", { name: /^Select column [A-Z]+ Index$/, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Select column [A-Z]+ index$/, exact: true }),
  ).toBeVisible();
  await cell(page, 0, 0).dblclick();
  const editor = page.getByRole("textbox", { name: "Edit name (string)" });
  await editor.fill("Beta");
  await editor.press("Enter");
  await expect(cell(page, 0, 0)).toHaveText("Beta");
  await page
    .getByRole("button", { name: "Sort and filter name", exact: true })
    .click();
  await page.getByRole("button", { name: "Sort ascending ↑" }).click();
  await expect(cell(page, 0, 0)).toHaveText("Alpha");
  await page.getByRole("button", { name: "Toggle value inspector" }).click();
  await cell(page, 0, 0).click();
  await expect(
    page.locator('.inspector label:has-text("Original index") + code'),
  ).toHaveText("1");
  await page.getByRole("button", { name: "Toggle value inspector" }).click();
  await page.locator(".freeze-menu summary").click();
  await page
    .getByRole("button", { name: "Freeze first column", exact: true })
    .click();
  await cell(page, 0, 0).click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Show original index", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Select column [A-Z]+ Index$/, exact: true }),
  ).toBeVisible();
  await expect(cell(page, 0, 0)).toHaveText("1");
  await expect(cell(page, 0, 1)).toHaveText("Alpha");
  await expect(cell(page, 0, 0).locator(".container-value")).toHaveCount(0);
  await cell(page, 0, 1).click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Hide original index", exact: true })
    .click();
  await expect(cell(page, 0, 0)).toHaveText("Alpha");
  await page
    .getByRole("button", { name: "Sort and filter name", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search filter values" })
    .fill("Alpha");
  await page
    .getByRole("button", { name: "Deselect shown", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply filter", exact: true }).click();
  await expect(cell(page, 0, 0)).toHaveText("Beta");
  await cell(page, 0, 0).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open row", exact: true }).click();
  await expect(
    grid(page).getByRole("gridcell", { name: "name", exact: true }),
  ).toBeVisible();
  await expect(
    grid(page).getByRole("gridcell", { name: "Beta", exact: true }),
  ).toBeVisible();
});

test("keeps source typing that occurs while dropped files are being prepared", async ({
  page,
}) => {
  await open(page, '{"original":true}', "original.json");
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open…", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    const read = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      if (this.name === "slow.json")
        await new Promise((resolve) => setTimeout(resolve, 600));
      return read.call(this);
    };
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(['{"new":true}'], "slow.json", { type: "application/json" }),
    );
    document.querySelector(".app-shell")!.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
  });
  await page
    .getByRole("textbox", { name: "JSON source draft" })
    .fill('{"typed_during_open":');
  await expect(
    page.getByRole("tab", { name: "slow.json", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: /^original.json/ }).click();
  await expect(
    page.getByRole("textbox", { name: "JSON source draft" }),
  ).toHaveText('{"typed_during_open":');
});
test("does not intercept text dragging or discard an active inline edit on file drop", async ({
  page,
}) => {
  await open(page, '[{"name":"Alpha"}]');
  const allowed = await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", "text");
    return document.querySelector(".app-shell")!.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
  });
  expect(allowed).toBe(true);
  await cell(page, 0, 0).dblclick();
  const editor = page.getByRole("textbox", { name: "Edit name (string)" });
  await editor.fill("Draft");
  await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(["{}"], "blocked.json", { type: "application/json" }),
    );
    document.querySelector(".app-shell")!.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
  });
  await expect(editor).toHaveValue("Draft");
  await expect(page.getByRole("tab", { name: "blocked.json" })).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "Finish the current edit" }),
  ).toBeVisible();
});

test("source typing stays quiet and validation runs only on Apply", async ({
  page,
}) => {
  await open(page, '{"first":1 "second":2}', "broken.json");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("A comma is missing");
  const disclosure = page.locator(".diagnostics summary");
  await expect(disclosure).toHaveText("Error details");
  await expect(disclosure.locator("svg")).toHaveCount(1);
  await disclosure.click();
  await expect(alert).toContainText("CommaExpected");
  const editor = page.getByRole("textbox", { name: "JSON source draft" });
  await editor.fill('{"first":1,"second":2}');
  await expect(page.locator(".source-actions")).toContainText(
    "Unapplied draft.",
  );
  await expect(alert).toHaveCount(0);
  await editor.fill('{"first":}');
  // A normal pause between typing lines must not produce an error banner.
  await page.waitForTimeout(650);
  await expect(alert).toHaveCount(0);
  await page.getByRole("button", { name: "Apply source", exact: true }).click();
  await expect(alert).toContainText("A JSON value is missing");
  await expect(
    alert.getByRole("button", { name: "Open another file…" }),
  ).toHaveCount(0);
  await expect(alert).not.toContainText("choose another file");
  await expect(alert).not.toContainText("A comma is missing");
  await editor.fill('{"first":3}');
  await expect(page.locator(".source-actions")).toContainText(
    "Unapplied draft.",
  );
  await expect(alert).toHaveCount(0);
  await page
    .getByRole("button", { name: "Discard draft", exact: true })
    .click();
  await expect(alert).toContainText("A comma is missing");
  await editor.fill('{"first":1,"second":2}');
  await expect(alert).toHaveCount(0);
  await page.getByRole("button", { name: "Apply source", exact: true }).click();
  await expect(page.locator(".source-actions")).toHaveCount(0);
  await expect(alert).toHaveCount(0);
});
