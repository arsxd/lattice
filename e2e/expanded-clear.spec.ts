import { test, expect, type Page } from "@playwright/test";
async function open(page: Page) {
  await page.addInitScript(() =>
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open…", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "nested.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      '{"a":{"label":"A","rooms":{"a1":1,"a2":2},"devices":{"devA":true}},"b":{"label":"B","rooms":{"b1":3},"devices":{"devB":false}}}',
    ),
  });
  await page.getByRole("checkbox", { name: "Show nested data" }).check();
  await expect(page.locator(".expanded-grid")).toBeVisible();
}
async function blank(page: Page) {
  const grid = page.locator(".expanded-grid"),
    box = await grid.boundingBox();
  await grid.click({ position: { x: box!.width - 15, y: box!.height - 15 } });
}
test("nested cell and header selections clear on background clicks", async ({
  page,
}) => {
  await open(page);
  const cell = page.locator('[data-r="0"][data-c="3"]');
  await cell.click();
  await expect(cell).toHaveClass(/expanded-selected/);
  await blank(page);
  await expect(
    page.locator(".expanded-selected,.expanded-active-cell"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Selected cell value" }),
  ).toHaveCount(0);
  const header = page.locator('.expanded-grid thead th[scope="col"]').nth(2);
  await header.locator(".column-select").click();
  await expect(header).toHaveAttribute("aria-selected", "true");
  await blank(page);
  await expect(
    page.locator('.expanded-grid th[aria-selected="true"]'),
  ).toHaveCount(0);
});
test("nested background clicks commit valid drafts and retain invalid drafts", async ({
  page,
}) => {
  await open(page);
  const cell = page.locator('[data-r="0"][data-c="3"]');
  await cell.dblclick();
  const editor = page.getByRole("textbox", {
    name: "Edit Data rooms / Value",
    exact: true,
  });
  await editor.fill("42");
  await blank(page);
  await expect(cell).toHaveText("42");
  await expect(page.locator(".expanded-active-cell")).toHaveCount(0);
  await cell.dblclick();
  await editor.fill("invalid");
  await blank(page);
  await expect(editor).toHaveValue("invalid");
  await expect(editor).toHaveAttribute("aria-invalid", "true");
});
