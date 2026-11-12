import { readFile, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Exercise the real browser file-input fallback with generated local fixtures.
  await page.addInitScript(() =>
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/");
});
async function open(page: Page, text: string, name = "smoke.json") {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open…", exact: true }).click();
  await (
    await chooser
  ).setFiles({ name, mimeType: "application/json", buffer: Buffer.from(text) });
  await expect(
    page.getByRole("grid", { name: "JSON data table" }),
  ).toBeVisible();
}
function cell(page: Page, row: number, column: number) {
  return page
    .getByRole("grid", { name: "JSON data table" })
    .locator(
      `[role="row"][aria-rowindex="${row + 2}"] [role="gridcell"][aria-colindex="${column + 2}"]`,
    );
}
test("opens a local JSON file, edits inline, and selects full rows and columns", async ({
  page,
}) => {
  await open(page, '[{"name":"Alpha","count":1},{"name":"Beta","count":2}]');
  await cell(page, 0, 1).dblclick();
  const editor = page.getByRole("textbox", { name: "Edit name (string)" });
  await editor.fill("Changed");
  await editor.press("Enter");
  await expect(cell(page, 0, 1)).toContainText("Changed");
  await page.getByRole("button", { name: "Select row 1", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Select row 1", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Select column count", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Select column count", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("review blocks invalid drafts and selectively restores a changed region", async ({
  page,
}) => {
  await open(page, '[{"name":"Original","count":1}]');
  await cell(page, 0, 1).dblclick();
  await page
    .getByRole("textbox", { name: "Edit name (string)" })
    .fill("Changed");
  await page
    .getByRole("textbox", { name: "Edit name (string)" })
    .press("Enter");
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  const draft = page.getByRole("textbox", { name: "Current JSON draft" });
  await draft.fill("{");
  await expect(
    page.getByRole("button", { name: "Apply changes", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("status").filter({ hasText: /validation issue/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Discard draft", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Restore this changed region from saved version into draft",
      exact: true,
    })
    .first()
    .click();
  await expect(draft).toContainText("Original");
  await expect(
    page.getByRole("button", { name: "Apply changes", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Apply changes", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Table", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await expect(cell(page, 0, 1)).toContainText("Changed");
});
test("keeps a resized frozen first row visible during scrolling", async ({
  page,
}) => {
  await open(
    page,
    JSON.stringify(
      Array.from({ length: 100 }, (_, i) => ({
        name: `Row ${i}`,
        description: "long content ".repeat(i === 0 ? 30 : 1),
      })),
    ),
  );
  const resizer = page.getByRole("separator", {
    name: "Resize row 1",
    exact: true,
  });
  await resizer.focus();
  await resizer.press("ArrowDown");
  await resizer.press("ArrowDown");
  await expect(resizer).toHaveAttribute("aria-valuenow", "44");
  await page.locator(".freeze-menu summary").click();
  await page
    .getByRole("button", { name: "Freeze first row", exact: true })
    .click();
  const first = page.getByRole("button", { name: "Select row 1", exact: true });
  const before = await first.boundingBox();
  await page
    .getByRole("grid", { name: "JSON data table" })
    .evaluate((element) => {
      element.scrollTop = 1200;
    });
  await expect
    .poll(() =>
      page
        .getByRole("grid", { name: "JSON data table" })
        .evaluate((element) => element.scrollTop),
    )
    .toBeGreaterThan(1000);
  await expect(first).toBeInViewport();
  await expect
    .poll(async () => Math.abs((await first.boundingBox())!.y - before!.y))
    .toBeLessThan(2);
  await expect(
    page.getByRole("button", { name: "Select row 40", exact: true }),
  ).toBeVisible();
});
test("recovers an opt-in invalid raw draft after refresh", async ({ page }) => {
  await page
    .getByRole("checkbox", { name: "Local recovery", exact: true })
    .check();
  await open(page, '[{"name":"Original"}]');
  await page.getByRole("button", { name: "Source", exact: true }).click();
  const draft = page.getByRole("textbox", { name: "JSON source draft" });
  await draft.fill('{"unfinished":');
  // Wait for the actual persisted snapshot, not merely the debounce timer.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("lattice-browser-recovery", 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          return await new Promise<string[]>((resolve, reject) => {
            const request = database
              .transaction("windows")
              .objectStore("windows")
              .getAll();
            request.onsuccess = () =>
              resolve(
                request.result.flatMap((record) =>
                  record.documents.map(
                    (document: { text: string }) => document.text,
                  ),
                ),
              );
            request.onerror = () => reject(request.error);
          });
        } finally {
          database.close();
        }
      }),
    )
    .toContain('{"unfinished":');
  page.on("dialog", (dialog) => void dialog.accept());
  await page.reload();
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await expect(page.getByRole("tab", { name: /smoke/ })).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "JSON source draft" }),
  ).toHaveText('{"unfinished":');
});
test("starts from cached application assets while offline", async ({
  page,
  context,
}) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Open JSON file…", exact: true }),
  ).toBeVisible();
  await open(page, '[{"offline":"works"}]');
  await expect(cell(page, 0, 1)).toContainText("works");
});

test("keeps a review draft through document switches and prevents silent Source discard", async ({
  page,
}) => {
  await open(page, '[{"name":"First"}]', "first.json");
  await open(page, '[{"name":"Second"}]', "second.json");
  await page.getByRole("tab", { name: /^first\.json/ }).click();
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Current JSON draft" })
    .fill('{"retained":');
  await expect(
    page.getByRole("button", { name: "Source", exact: true }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "second.json", exact: true }).click();
  await page.getByRole("tab", { name: /^first\.json/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Current JSON draft" }),
  ).toHaveText('{"retained":');
});
test("announces a real waiting service worker without replacing a dirty draft", async ({
  page,
}) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await open(page, '[{"name":"Original"}]');
  await page.getByRole("button", { name: "Source", exact: true }).click();
  const draft = page.getByRole("textbox", { name: "JSON source draft" });
  await draft.fill('{"keep":');
  const workerPath = new URL("../dist/sw.js", import.meta.url);
  const original = await readFile(workerPath, "utf8");
  try {
    await writeFile(
      workerPath,
      original + `\n// browser update smoke ${Date.now()}\n`,
    );
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) throw new Error("Service worker missing");
      await registration.update();
    });
    await page
      .getByRole("button", { name: "Update available", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "close all Lattice tabs",
    );
    await page
      .getByRole("button", { name: "Keep working", exact: true })
      .click();
    await expect(draft).toHaveText('{"keep":');
    await expect(
      page.getByRole("button", { name: "Update available", exact: true }),
    ).toBeVisible();
  } finally {
    await writeFile(workerPath, original);
  }
});

test("reload retains selected property page and scroll after external column reordering", async ({
  page,
}) => {
  await page.evaluate(() => {
    const state = window as unknown as {
      reloadText: string;
      showOpenFilePicker: unknown;
    };
    state.reloadText = JSON.stringify(
      Array.from({ length: 620 }, (_, id) => ({ id, name: `row-${id}` })),
    );
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      value: async () => [
        {
          kind: "file",
          name: "reload.json",
          getFile: async () =>
            new File([state.reloadText], "reload.json", {
              type: "application/json",
            }),
        },
      ],
    });
  });
  await page.getByRole("button", { name: "Open…", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("grid", { name: "JSON data table" })
    .evaluate((element) => (element.scrollTop = 700));
  await page
    .locator('[role="gridcell"][aria-colindex="3"]')
    .filter({ hasText: /^530$/ })
    .click();
  const before = await page
    .getByRole("grid", { name: "JSON data table" })
    .evaluate((element) => element.scrollTop);
  await page.evaluate(() => {
    (window as unknown as { reloadText: string }).reloadText = JSON.stringify(
      Array.from({ length: 620 }, (_, id) => ({
        name: `row-${id}`,
        id,
        extra: true,
      })),
    );
  });
  await page
    .getByRole("button", { name: "Reload source…", exact: true })
    .click();
  await expect(page.locator(".pagination")).toContainText("Page 2 / 2");
  await expect(page.locator(".value-bar input")).toHaveValue("530");
  await expect
    .poll(() =>
      page
        .getByRole("grid", { name: "JSON data table" })
        .evaluate((element) => element.scrollTop),
    )
    .toBe(before);
  await expect(
    page.getByRole("button", { name: "Select column id", exact: true }),
  ).toContainText("C");
});
