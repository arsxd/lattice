import { test, expect } from "@playwright/test";

async function sample(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore sample workspace", exact: true })
    .click();
  await page.getByRole("grid", { name: "JSON data table" }).waitFor();
}

test("visible action labels remain in accessible names and document tabs exclude close controls", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Star on GitHub", exact: true }),
  ).toBeVisible();
  await sample(page);
  await expect(
    page.getByRole("button", { name: /Details.*toggle value inspector/i }),
  ).toBeVisible();
  const header = page.getByRole("button", {
    name: /^Select column [A-Z]+ title$/,
    exact: true,
  });
  await expect(header).toHaveAccessibleName(/^Select column [A-Z]+ title$/);
  const accessibility = await page.locator(".document-tabs").ariaSnapshot();
  expect(accessibility).toContain('tablist "Open documents"');
  expect(accessibility).toContain('tab "bookshop-workspace.json"');
  const tablist = page.getByRole("tablist", {
    name: "Open documents",
    exact: true,
  });
  await expect(tablist.locator('button:not([role="tab"])')).toHaveCount(0);
  expect(await tablist.ariaSnapshot()).not.toContain('button "Close');
  await expect(
    page.getByRole("button", {
      name: "Close bookshop-workspace.json",
      exact: true,
    }),
  ).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open…", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "second.json",
    mimeType: "application/json",
    buffer: Buffer.from('[{"value":1}]'),
  });
  const second = page.getByRole("tab", { name: "second.json", exact: true });
  await expect(second).toHaveAttribute("aria-selected", "true");
  await second.press("ArrowLeft");
  await expect(
    page.getByRole("tab", { name: "bookshop-workspace.json", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Close second.json", exact: true })
    .click();
  await expect(second).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "bookshop-workspace.json", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

test("saved Review source is keyboard-focusable, scrollable and read-only", async ({
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
  await page.getByRole("button", { name: "Open…", exact: true }).click();
  const text = JSON.stringify(
    Array.from({ length: 100 }, (_, id) => ({ id, name: `Record ${id}` })),
    null,
    2,
  );
  await (
    await chooser
  ).setFiles({
    name: "keyboard-review.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
  await page.getByRole("grid", { name: "JSON data table" }).waitFor();
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  const show = page.getByRole("button", {
    name: "Show unchanged lines",
    exact: true,
  });
  await show.click();
  const saved = page.getByRole("textbox", {
    name: "Saved version",
    exact: true,
  });
  await expect(saved).toHaveAttribute("aria-readonly", "true");
  await expect(saved).toHaveAttribute("tabindex", "0");
  await page
    .getByRole("button", { name: /^(Show|Hide) unchanged lines$/ })
    .focus();
  // Native Tab must reach the saved source, not just programmatic focus.
  for (
    let i = 0;
    i < 15 && !(await saved.evaluate((el) => el === document.activeElement));
    i++
  )
    await page.keyboard.press("Tab");
  await expect(saved).toBeFocused();
  await page.keyboard.press("PageDown");
  await expect
    .poll(() => page.locator(".diff-host").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await page.keyboard.type("SHOULD_NOT_EDIT");
  await expect(saved).toHaveAttribute("contenteditable", "false");
  await expect(saved).not.toContainText("SHOULD_NOT_EDIT");
  await expect(
    page.getByRole("textbox", { name: "Current JSON draft" }),
  ).not.toContainText("SHOULD_NOT_EDIT");
});
