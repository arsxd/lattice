import { test, expect } from "@playwright/test";
test("multiple nested tables stay above one action bar targeting the selected table", async ({
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
    name: "nested.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        key: {
          settings: { mode: "A", enabled: true },
          items: [{ qty: 1 }, {}],
          shipments: [{ status: "Ready" }, {}],
          tags: ["one", "two"],
        },
      }),
    ),
  });
  await page.getByRole("checkbox", { name: "Show nested data" }).check();
  const items = page.getByRole("table", { name: "items data", exact: true });
  const shipments = page.getByRole("table", {
    name: "shipments data",
    exact: true,
  });
  await expect(items).toBeVisible();
  await expect(shipments).toBeVisible();
  await expect(page.locator(".expanded-sheets .pagination")).toHaveCount(1);
  await expect(page.locator(".expanded-section .pagination")).toHaveCount(0);
  const viewport = await page.locator(".expanded-sections").boundingBox();
  const actions = await page.locator(".expanded-toolbar-host").boundingBox();
  expect(viewport!.y + viewport!.height).toBeLessThanOrEqual(actions!.y + 1);
  await shipments.locator('[data-r="0"][data-c="2"]').click();
  const toolbar = page.getByRole("group", {
    name: "shipments table actions",
    exact: true,
  });
  await expect(toolbar).toBeVisible();
  await toolbar
    .getByRole("button", { name: "Add column", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "New shipments column" })
    .fill("tracking");
  await toolbar.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    shipments.getByRole("button", { name: "tracking", exact: true }),
  ).toBeVisible();
  await expect(
    items.getByRole("button", { name: "tracking", exact: true }),
  ).toHaveCount(0);
  await items.locator('[data-r="0"][data-c="2"]').click();
  await expect(
    page.getByRole("group", { name: "items table actions", exact: true }),
  ).toBeVisible();
  await expect(shipments.locator(".expanded-active-cell")).toHaveCount(0);
  await page.screenshot({ path: "output/multiple-nested-tables.png" });
  await page.setViewportSize({ width: 1440, height: 650 });
  const footer = await page.locator(".expanded-toolbar-host").boundingBox();
  const tabs = await page
    .getByRole("navigation", { name: "Document sheets" })
    .boundingBox();
  expect(Math.abs(footer!.y + footer!.height - tabs!.y)).toBeLessThanOrEqual(2);
});
