import { test, expect } from "@playwright/test";
test("redesigned workspace keeps the value bar visibly editable in both themes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("checkbox", { name: "Show nested data" }),
  ).toHaveCount(0);
  await expect(page.locator(".expanded-sheets")).toHaveCount(0);
  await page.getByRole("button", { name: "Try sample" }).click();
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
  await expect(page.locator(".value-bar-field")).toHaveCSS(
    "border-top-width",
    "1px",
  );
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
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await expect(bar).toBeEditable();
  await page.screenshot({ path: "output/redesigned-workspace-dark.png" });
  await bar.fill("Discard this");
  await bar.press("Escape");
  await expect(bar).toHaveValue('"A Quiet Kitchen"');
});

test("abandoned file drag feedback clears without changing the workspace", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(["{}"], "example.json", { type: "application/json" }),
    );
    document.querySelector(".app-shell")!.dispatchEvent(
      new DragEvent("dragenter", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
  });
  await expect(page.locator(".file-drop-hint")).toBeVisible();
  await expect(page.locator(".file-drop-hint")).toHaveCSS(
    "border-top-style",
    "dashed",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".file-drop-overlay")).toHaveCount(0);
  await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(["{}"], "example.json", { type: "application/json" }),
    );
    document.querySelector(".app-shell")!.dispatchEvent(
      new DragEvent("dragenter", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
  });
  await expect(page.locator(".file-drop-overlay")).toBeVisible();
  await expect(page.locator(".file-drop-overlay")).toHaveCount(0, {
    timeout: 4000,
  });
});
