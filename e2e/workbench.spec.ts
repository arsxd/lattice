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
    page.getByRole("alert").filter({ hasText: /Cannot apply/ }),
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
  ).toHaveCount(0);
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
  await expect(
    page.getByRole("textbox", { name: "Selected cell value" }),
  ).toHaveValue("530");
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

test("highlights the entire selected header and avoids a duplicate Browse filename", async ({
  page,
}) => {
  await open(page, '[{"name":"Alpha","count":1}]', "header-test.json");
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(page.locator(".outline")).not.toContainText("header-test.json");
  const button = page.getByRole("button", {
    name: "Select column name",
    exact: true,
  });
  await button.click();
  const header = page.locator(".sheet-header-selected");
  await expect(header).toHaveCount(1);
  await expect(header).toContainText("name");
  expect(
    await button.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).toBe("rgba(0, 0, 0, 0)");
  expect(
    await header.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).not.toBe("rgba(0, 0, 0, 0)");
  await button.focus();
  expect(
    await button.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).toBe("none");
  await expect(page.locator(".status .document-filename")).toHaveAttribute(
    "title",
    /full disk path/,
  );
});

test("review keeps unchanged lines neutral for distant JSON edits and uses one toolbar", async ({
  page,
}) => {
  const before = JSON.stringify(
    Array.from({ length: 240 }, (_, id) => ({
      id,
      logo: null,
      name: null,
      prices: Array.from({ length: 24 }, (_, i) => ({
        amount: i,
        category: "regular",
      })),
    })),
    null,
    2,
  );
  await open(page, before, "sparse-edits.json");
  for (const id of [1, 40, 80, 120, 160, 200]) {
    await page
      .getByRole("grid", { name: "JSON data table" })
      .evaluate((element, top) => (element.scrollTop = top), id * 28);
    await cell(page, id, 1).dblclick();
    const editor = page.getByRole("textbox", { name: "Edit id (number)" });
    await editor.fill("445");
    await editor.press("Enter");
    await expect(editor).toHaveCount(0);
    await expect(cell(page, id, 1)).toHaveText("445");
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  }
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  await expect(page.locator(".diff-tools")).toContainText("6 changed regions");
  await expect(page.locator(".diff-tools")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Validate", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator(".diff-review").getByText("Valid JSON", { exact: true }),
  ).toHaveCount(0);
  const changed = page.locator(".diff-host .cm-changedLine");
  expect(await changed.count()).toBeGreaterThan(0);
  for (const text of await changed.allTextContents())
    expect(text).toContain('"id":');
  const neutral = page
    .locator(".diff-host .cm-line")
    .filter({ hasText: '"logo": null' })
    .first();
  await expect(neutral).not.toHaveClass(/cm-changedLine/);
  const draft = page.getByRole("textbox", { name: "Current JSON draft" });
  await draft.click();
  await draft.press("ControlOrMeta+Home");
  await page.keyboard.type("x");
  await expect(
    page.getByRole("button", { name: "Apply changes", exact: true }),
  ).toBeDisabled();
  await draft.press("ControlOrMeta+z");
  await expect(
    page.getByRole("button", { name: "Apply changes", exact: true }),
  ).toHaveCount(0);
});

test("array inline editing stays compact with readable selection and bounded value expansion", async ({
  page,
}) => {
  await open(
    page,
    JSON.stringify(
      [
        {
          signals: ["PWMHBR"],
          list: Array.from({ length: 20 }, (_, i) => `signal-${i}`),
        },
      ],
      null,
      2,
    ),
  );
  await cell(page, 0, 1).dblclick();
  const editor = page.getByRole("textbox", { name: "Edit signals (array)" });
  await expect(editor).toHaveValue('["PWMHBR"]');
  await expect(editor).toHaveAttribute("wrap", "off");
  expect(
    await editor.evaluate((e) => getComputedStyle(e, "::selection").color),
  ).toBe("rgb(255, 255, 255)");
  await editor.press("Escape");
  await page.getByRole("button", { name: "Wrap text", exact: true }).click();
  await cell(page, 0, 1).dblclick();
  await expect(editor).toHaveValue('["PWMHBR"]');
  await expect(editor).toHaveAttribute("wrap", "soft");
  await editor.press("Escape");
  await cell(page, 0, 2).click();
  const bar = page.getByRole("textbox", { name: "Selected cell value" });
  await expect(bar).toHaveValue(/signal-19/);
  expect(
    await bar.evaluate((e) => e.getBoundingClientRect().height),
  ).toBeLessThanOrEqual(74);
  await page.getByRole("button", { name: "Toggle value inspector" }).click();
  await expect(page.locator(".details-preview tbody tr")).toHaveCount(20);
});

test("header and corner selections show a range summary instead of the first value", async ({
  page,
}) => {
  await open(page, '[{"name":"Alpha","count":1},{"name":"Beta","count":2}]');
  await cell(page, 0, 1).click();
  await page.getByRole("button", { name: "Toggle value inspector" }).click();
  await expect(page.locator(".inspector .type-label")).toHaveText("string");
  await page
    .getByRole("button", { name: "Select column name", exact: true })
    .click();
  await expect(page.locator(".inspector")).toContainText("cells selected");
  await expect(page.locator(".inspector .type-label")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Selected cell value" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Select all table cells", exact: true })
    .click();
  await expect(page.locator(".inspector")).toContainText("6 cells selected");
  const header = page.locator(".sheet-header").filter({
    has: page.getByRole("button", {
      name: "Select column count",
      exact: true,
    }),
  });
  const width = await header.evaluate((e) => e.getBoundingClientRect().width);
  await header.click({ position: { x: width - 3, y: 3 } });
  await expect(
    page.getByRole("button", { name: "Select column count", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Sort and filter count", exact: true })
    .click();
  await expect(page.locator(".column-menu")).toBeVisible();
});

test("column titles reserve filter space and two-column views use the available width", async ({
  page,
}) => {
  await open(
    page,
    '[{"an_intentionally_long_column_title":"a","the_last_column_title":"b"}]',
  );
  const overlap = await page
    .locator(".sheet-column-heading")
    .evaluateAll((headings) =>
      headings.some((heading) => {
        const title = heading
          .querySelector(".column-select > span")!
          .getBoundingClientRect();
        const arrow = heading
          .querySelector(".header-filter")!
          .getBoundingClientRect();
        return title.right > arrow.left + 1;
      }),
    );
  expect(overlap).toBe(false);
  await open(
    page,
    '{"a_long_but_readable_key_name":"value","other":"data"}',
    "two-columns.json",
  );
  const dimensions = await page
    .getByRole("grid")
    .evaluate((e) => ({ client: e.clientWidth, scroll: e.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 2);
});

test("freeze menu offers selected-header actions with prefix semantics", async ({
  page,
}) => {
  await open(
    page,
    JSON.stringify(
      Array.from({ length: 20 }, (_, i) => ({ name: `row-${i}`, count: i })),
    ),
  );
  await page.getByRole("button", { name: "Select row 3", exact: true }).click();
  await page.locator(".freeze-menu summary").click();
  await page
    .getByRole("button", { name: "Freeze selected row", exact: true })
    .click();
  await expect(
    page.locator('.data-grid [role=row][style*="sticky"]'),
  ).toHaveCount(3);
  await page
    .getByRole("button", { name: "Select column name", exact: true })
    .click();
  await page.locator(".freeze-menu summary").click();
  await expect(
    page.getByRole("button", { name: "Freeze selected column", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Freeze selected column", exact: true })
    .click();
  await expect(page.locator(".freeze-menu summary")).toHaveText("Frozen panes");
});

test("scoped Source applies only its table and survives document switching", async ({
  page,
}) => {
  const original =
    '{"group":{"items":[{"value":1}],"keep":"outside-table"},"sibling":{"precise":9007199254740993,"label":"untouched"}}';
  await open(page, original, "scoped.json");
  await page.getByRole("gridcell", { name: "group", exact: true }).dblclick();
  await page.getByRole("gridcell", { name: "items", exact: true }).dblclick();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "JSON source draft" });
  await expect(editor).toHaveText('[{"value":1}]');
  await expect(
    page.getByRole("button", { name: "This table", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await editor.fill('[{"value":2,"note":"new"}]');
  await open(page, '{"other":true}', "other.json");
  await page.getByRole("tab", { name: /^scoped.json/ }).click();
  await expect(editor).toHaveText('[{"value":2,"note":"new"}]');
  await page.getByRole("button", { name: "Apply source", exact: true }).click();
  await page
    .getByRole("button", { name: "Whole document", exact: true })
    .click();
  await expect(editor).toContainText('"keep":"outside-table"');
  await expect(editor).toContainText('"precise":9007199254740993');
  await expect(editor).toContainText('"value":2');
});

test("Review toggles back to its previous view and confirms discarding a dirty draft", async ({
  page,
}) => {
  await open(page, '[{"name":"Original"}]');
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  await page.getByRole("button", { name: "Close review", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Table", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  const draft = page.getByRole("textbox", { name: "Current JSON draft" });
  await draft.fill('[{"name":"Draft"}]');
  await page.getByRole("button", { name: "Close review", exact: true }).click();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(draft).toContainText("Draft");
  await page.getByRole("button", { name: "Close review", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Source", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("textbox", { name: "JSON source draft" }),
  ).toContainText("Original");
});

test("recovers an incomplete scoped draft without losing sibling data", async ({
  page,
}) => {
  await page
    .getByRole("checkbox", { name: "Local recovery", exact: true })
    .check();
  await open(
    page,
    '{"outside":9007199254740993,"items":[{"value":1}],"tail":"retained"}',
  );
  await page.getByRole("gridcell", { name: "items", exact: true }).dblclick();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  const draft = page.getByRole("textbox", { name: "JSON source draft" });
  await expect(draft).toHaveText('[{"value":1}]');
  await draft.fill("[");
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
    .toContain('{"outside":9007199254740993,"items":[,"tail":"retained"}');
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
  ).toHaveText('{"outside":9007199254740993,"items":[,"tail":"retained"}');
});

test("value bar commits and cancels bounded multiline edits", async ({
  page,
}) => {
  await open(page, '[{"note":"original"}]');
  await cell(page, 0, 1).click();
  const bar = page.getByRole("textbox", { name: "Selected cell value" });
  await bar.fill("cancelled");
  await bar.press("Escape");
  await expect(bar).toHaveValue("original");
  await bar.fill("line one");
  await bar.press("End");
  await bar.press("Shift+Enter");
  await bar.pressSequentially("line two");
  await bar.press("Enter");
  await expect(cell(page, 0, 1)).toContainText("line one");
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "JSON source draft" }),
  ).toContainText("line one\\nline two");
});
