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
  await page.addInitScript(() =>
    localStorage.setItem("lattice-show-index", "true"),
  );
  await page.goto("/");
});
// Review is only available once something has changed.
async function editFirstName(page: Page, value = "Edited") {
  await cell(page, 0, 1).dblclick();
  const editor = page.getByRole("textbox", { name: "Edit name (string)" });
  await editor.fill(value);
  await editor.press("Enter");
}
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
    .getByRole("button", { name: /^Select column [A-Z]+ count$/, exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: /^Select column [A-Z]+ count$/,
      exact: true,
    }),
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
  const first = page.getByRole("button", {
    name: "Select row 1",
    exact: true,
  });
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
  await editFirstName(page);
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
    await expect(
      page.getByRole("button", { name: "Update now", exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole("dialog")).toContainText(/build [0-9a-f]{7}/);
    await expect(page.locator(".app-version")).toHaveAttribute(
      "title",
      /build [0-9a-f]{7}/i,
    );
    await page
      .getByRole("button", { name: "Keep working", exact: true })
      .click();
    await expect(draft).toHaveText('{"keep":');
    await expect(
      page.getByRole("button", { name: "Update available", exact: true }),
    ).toBeVisible();
    const home = await page.context().newPage();
    await home.goto(page.url());
    await home
      .getByRole("button", { name: "Update available", exact: true })
      .click();
    await Promise.all([
      home.waitForEvent("framenavigated"),
      home.getByRole("button", { name: "Update now", exact: true }).click(),
    ]);
    await expect(
      home.getByRole("button", { name: "Update available", exact: true }),
    ).toHaveCount(0);
    await expect(draft).toHaveText('{"keep":');
    expect(
      await home.evaluate(
        async () =>
          (await navigator.serviceWorker.getRegistration())?.waiting ?? null,
      ),
    ).toBeNull();
    await home.close();
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
  await page.getByRole("button", { name: "Reload file", exact: true }).click();
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
    page.getByRole("button", {
      name: /^Select column [A-Z]+ id$/,
      exact: true,
    }),
  ).toContainText("C");
});

test("highlights the entire selected header and avoids a duplicate Browse filename", async ({
  page,
}) => {
  await open(page, '[{"name":"Alpha","count":1}]', "header-test.json");
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(page.locator(".outline")).not.toContainText("header-test.json");
  const button = page.getByRole("button", {
    name: /^Select column [A-Z]+ name$/,
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
    /File information and copy filename/,
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
          tags: ["alpha"],
          list: Array.from({ length: 20 }, (_, i) => `item-${i}`),
        },
      ],
      null,
      2,
    ),
  );
  await cell(page, 0, 1).dblclick();
  const editor = page.getByRole("textbox", { name: "Edit tags (array)" });
  await expect(editor).toHaveValue('["alpha"]');
  await expect(editor).toHaveAttribute("wrap", "off");
  expect(
    await editor.evaluate((e) => getComputedStyle(e, "::selection").color),
  ).toBe("rgb(255, 255, 255)");
  await editor.press("Escape");
  await page.getByRole("button", { name: "Wrap text", exact: true }).click();
  await cell(page, 0, 1).dblclick();
  await expect(editor).toHaveValue('["alpha"]');
  await expect(editor).toHaveAttribute("wrap", "soft");
  await editor.press("Escape");
  await cell(page, 0, 2).click();
  const bar = page.getByRole("textbox", { name: "Selected cell value" });
  await expect(bar).toHaveValue(/item-19/);
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
    .getByRole("button", { name: /^Select column [A-Z]+ name$/, exact: true })
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
      name: /^Select column [A-Z]+ count$/,
      exact: true,
    }),
  });
  const width = await header.evaluate((e) => e.getBoundingClientRect().width);
  await header.click({ position: { x: width - 3, y: 3 } });
  await expect(
    page.getByRole("button", {
      name: /^Select column [A-Z]+ count$/,
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Sort and filter count", exact: true })
    .click();
  await expect(page.locator(".column-menu")).toBeVisible();
});

test("column titles reserve filter space and compact property tables avoid horizontal scrolling", async ({
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
    .getByRole("button", { name: /^Select column [A-Z]+ name$/, exact: true })
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
  await editFirstName(page, "Original v2");
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
  await draft.fill("");
  await draft.press("[");
  await draft.press("Delete");
  await expect(draft).toHaveText("[");
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
  await expect(bar).toHaveValue('"original"');
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

test("sort waits for the complete nested-table edit refresh", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = new Proxy(NativeWorker, {
      construct(Target, args) {
        const worker = new Target(...(args as [string | URL, WorkerOptions?]));
        let pending = -1;
        const post = worker.postMessage.bind(worker);
        worker.postMessage = (message: any, options?: any) => {
          if (message.action === "mutate") pending = 0;
          post(message, options);
        };
        Object.defineProperty(worker, "onmessage", {
          set(handler) {
            worker.addEventListener("message", (event) => {
              const value = event.data.value;
              if (
                pending >= 0 &&
                value?.rows &&
                value?.headers &&
                ++pending === 1
              ) {
                pending = -1;
                (window as any).delayedRefresh = true;
                setTimeout(() => handler.call(worker, event), 1000);
              } else handler.call(worker, event);
            });
          },
        });
        return worker;
      },
    });
  });
  await page.reload();
  await open(page, '{"records":[{"price":12.5},{"price":12.5}]}');
  const records = page.getByRole("gridcell", { name: "records", exact: true });
  if (await records.count()) await records.dblclick();
  await cell(page, 0, 1).dblclick();
  await page
    .getByRole("textbox", { name: "Edit price (number)" })
    .fill("19.75");
  await page
    .getByRole("textbox", { name: "Edit price (number)" })
    .press("Enter");
  const filter = page.getByRole("button", {
    name: "Sort and filter price",
    exact: true,
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).delayedRefresh))
    .toBe(true);
  await expect(filter).toBeDisabled();
  await expect(filter).toBeEnabled();
  await expect(cell(page, 0, 1)).toHaveText("19.75");
  await filter.click();
  await page
    .getByRole("button", { name: "Sort ascending ↑", exact: true })
    .click();
  await expect(cell(page, 0, 1)).toHaveText("12.5");
});

test("keyboard navigation, editing and filter dismissal retain usable focus", async ({
  page,
}) => {
  await open(page, '[{"name":"Alpha","count":1},{"name":"Beta","count":2}]');
  await cell(page, 0, 1).click();
  await page.keyboard.press("ArrowRight");
  await expect(cell(page, 0, 2)).toBeFocused();
  await page.keyboard.press("F2");
  const editor = page.getByRole("textbox", { name: "Edit count (number)" });
  await expect(editor).toBeFocused();
  await editor.fill("99");
  await editor.press("Escape");
  await expect(cell(page, 0, 2)).toHaveText("1");
  await expect(cell(page, 0, 2)).toBeFocused();
  const filter = page.getByRole("button", {
    name: "Sort and filter count",
    exact: true,
  });
  await filter.focus();
  await filter.press("Enter");
  await expect(
    page.getByRole("textbox", { name: "Search filter values" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Sort and filter count" }),
  ).toHaveCount(0);
  await expect(filter).toBeFocused();
});

test("minimum-width toolbar retains all controls and confirmation traps focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 500 });
  await open(page, '[{"name":"Alpha"}]');
  const bounds = await page.locator(".toolbar").evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    right: Math.max(
      ...[...element.querySelectorAll("button, select")].map(
        (control) => control.getBoundingClientRect().right,
      ),
    ),
  }));
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width);
  expect(bounds.right).toBeLessThanOrEqual(718);
  await editFirstName(page);
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Current JSON draft" })
    .fill('[{"name":"Changed"}]');
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Close review", exact: true }).click();
  const keep = page.getByRole("button", { name: "Keep editing", exact: true });
  await expect(keep).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Discard changes", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(keep).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Current JSON draft" }),
  ).toContainText("Changed");
});

test("Details contents fill a wide pane and retain readable widths in a narrow pane", async ({
  page,
}) => {
  await page.evaluate(() =>
    localStorage.setItem("lattice-pane-details", "520"),
  );
  await page.reload();
  await open(
    page,
    '[{"nested":[{"areas":[1,2,3],"seatCategoryId":338937277},{"areas":[4,5],"seatCategoryId":338937278}]}]',
  );
  await cell(page, 0, 1).click();
  await page.getByRole("button", { name: "Toggle value inspector" }).click();
  const table = page.getByRole("table", { name: "Selected value contents" });
  await expect(table).toBeVisible();
  const dimensions = () =>
    table.evaluate((element) => ({
      table: element.getBoundingClientRect().width,
      viewport: element.parentElement!.clientWidth,
      scroll: element.parentElement!.scrollWidth,
    }));
  const wide = await dimensions();
  expect(wide.viewport).toBeGreaterThan(424);
  expect(Math.abs(wide.table - wide.viewport)).toBeLessThanOrEqual(1);
  await page
    .getByRole("separator", { name: "Resize Details pane" })
    .press("Home");
  await expect
    .poll(async () => (await dimensions()).viewport)
    .toBeLessThan(424);
  const narrow = await dimensions();
  expect(narrow.table).toBeGreaterThanOrEqual(424);
  expect(narrow.scroll).toBeGreaterThan(narrow.viewport);
});

test("selecting a column header shows its name in the value bar and can copy it", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page, '[{"name":"Alpha","count":1},{"name":"Beta","count":2}]');
  const header = page.getByRole("button", {
    name: /^Select column [A-Z]+ count$/,
    exact: true,
  });
  await header.click();
  await expect(
    page.getByLabel("Selected column name", { exact: true }),
  ).toHaveText("count");
  await header.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Copy column name" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "count",
  );
});

test("rows are numbered from 1 in every kind of table", async ({ page }) => {
  await open(page, '[{"a":1},{"a":2}]');
  await expect(
    page.getByRole("button", { name: "Select row 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Select row 2", exact: true }),
  ).toBeVisible();
  await open(page, '{"x":{"a":1},"y":{"a":2}}');
  await expect(
    page.getByRole("button", { name: "Select row 1", exact: true }),
  ).toBeVisible();
});

test("Find highlights matching column names and counts them", async ({
  page,
}) => {
  await open(page, '[{"price":1,"stock":2},{"price":3,"stock":4}]');
  await page.locator("#find").fill("pri");
  await expect(
    page.locator(".sheet-column-heading mark.find-match"),
  ).toHaveText("pri");
  await expect(page.locator(".find-count")).toContainText("1 column name");
  await expect(page.locator(".empty-table")).toContainText(
    "matches a column name",
  );
});

test("Wrap text shows long text in full when there is room", async ({
  page,
}) => {
  const note = "word ".repeat(300).trim();
  await open(page, JSON.stringify([{ note }]));
  await expect(cell(page, 0, 1)).toContainText("…");
  await page.getByRole("button", { name: "Wrap text", exact: true }).click();
  await expect(cell(page, 0, 1)).toContainText(note.slice(-200));
  await expect
    .poll(() =>
      cell(page, 0, 1).evaluate((e) => e.getBoundingClientRect().height),
    )
    .toBeGreaterThan(200);
  await page.getByRole("button", { name: "Wrap text", exact: true }).click();
  await expect(cell(page, 0, 1)).toContainText("…");
});

test("Review changes is available only when there is something to review", async ({
  page,
}) => {
  await open(page, '[{"name":"Alpha"}]');
  const review = page.getByRole("button", {
    name: "Review changes",
    exact: true,
  });
  await expect(review).toBeDisabled();
  await cell(page, 0, 1).dblclick();
  const editor = page.getByRole("textbox", { name: "Edit name (string)" });
  await editor.fill("Beta");
  await editor.press("Enter");
  await expect(review).toBeEnabled();
});

test("the value bar offers Expand only when the value needs more room", async ({
  page,
}) => {
  await open(
    page,
    JSON.stringify([{ short: "Alpha", long: "word ".repeat(400) }]),
  );
  const expand = page.getByRole("button", { name: "Expand value bar" });
  await cell(page, 0, 1).click();
  await expect(
    page.getByRole("textbox", { name: "Selected cell value" }),
  ).toHaveValue('"Alpha"');
  await expect(expand).toHaveCount(0);
  await cell(page, 0, 2).click();
  await expect(expand).toBeVisible();
  await expand.click();
  await expect
    .poll(() =>
      page
        .getByRole("textbox", { name: "Selected cell value" })
        .evaluate((e) => e.getBoundingClientRect().height),
    )
    .toBeGreaterThan(60);
});

test("nested values are coloured like Source and still highlight Find matches", async ({
  page,
}) => {
  await open(
    page,
    '[{"name":"A","details":{"edition":3,"lang":"en","ok":true,"n":null}}]',
  );
  const nested = cell(page, 0, 2);
  await expect(nested.locator(".json-number")).toHaveText("3");
  await expect(nested.locator(".json-string")).toHaveText('"en"');
  await expect(nested.locator(".json-literal")).toHaveText(["true", "null"]);
  // Plain values stay uncoloured.
  await expect(cell(page, 0, 1).locator(".json-string")).toHaveCount(0);
  await page.locator("#find").fill("edition");
  await expect(nested.locator("mark.find-match")).toHaveText("edition");
  await expect(nested).toContainText('"edition": 3');
});

test("Find highlights a match that lies beyond the cell preview", async ({
  page,
}) => {
  const note = "x".repeat(600) + " NEEDLE " + "y".repeat(100);
  await open(page, JSON.stringify([{ id: 1, note }]));
  await page.locator("#find").fill("NEEDLE");
  await expect(page.locator(".find-count")).toContainText("1 cell");
  await expect(cell(page, 0, 2).locator("mark.find-match")).toHaveText(
    "NEEDLE",
  );
  await page.locator("#find").fill("");
  await expect(cell(page, 0, 2).locator("mark.find-match")).toHaveCount(0);
});

test("context menus offer the right copy-name action for rows and columns", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page, '{"x":{"a":1},"y":{"a":2}}');
  const rowNumber = page.getByRole("button", {
    name: "Select row 2",
    exact: true,
  });
  await rowNumber.click({ button: "right" });
  await expect(
    page.getByRole("menuitem", { name: "Copy column name" }),
  ).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Copy row name" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("y");
  // A cell belongs to both a row and a column.
  await cell(page, 0, 1).click({ button: "right" });
  await expect(
    page.getByRole("menuitem", { name: "Copy row name" }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Copy column name" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  // Array rows have no name to copy.
  await open(page, '[{"a":1},{"a":2}]');
  await page
    .getByRole("button", { name: "Select row 1", exact: true })
    .click({ button: "right" });
  await expect(
    page.getByRole("menuitem", { name: /^Copy (row|column) name$/ }),
  ).toHaveCount(0);
});

test("the column menu button is inset from the header cell edges", async ({
  page,
}) => {
  await open(page, '[{"name":"Alpha"}]');
  const gap = await page.evaluate(() => {
    const heading = document.querySelector(".sheet-column-heading")!;
    const cell = heading
      .closest('[role="columnheader"]')!
      .getBoundingClientRect();
    const button = heading
      .querySelector(".header-filter")!
      .getBoundingClientRect();
    return {
      right: cell.right - button.right,
      bottom: cell.bottom - button.bottom,
    };
  });
  expect(gap.right).toBeGreaterThanOrEqual(3);
  expect(gap.bottom).toBeGreaterThanOrEqual(3);
});

test("editing a cell keeps its row height and font, and only grows for extra lines", async ({
  page,
}) => {
  await open(page, '[{"name":"Alpha"},{"name":"Beta"}]');
  const row = page.locator('[role="row"][aria-rowindex="2"]');
  const second = page.locator('[role="row"][aria-rowindex="3"]');
  const measure = () =>
    page.evaluate(() => {
      const r = (i: number) =>
        document
          .querySelector(`[role="row"][aria-rowindex="${i}"]`)!
          .getBoundingClientRect();
      const font = (el: Element | null) =>
        el
          ? getComputedStyle(el).fontFamily + getComputedStyle(el).fontSize
          : "";
      return {
        height: r(2).height,
        nextTop: r(3).top,
        cellFont: font(
          document.querySelector(
            '[role="row"][aria-rowindex="3"] [role="gridcell"][aria-colindex="3"]',
          ),
        ),
        editorFont: font(document.querySelector(".inline-cell")),
      };
    });
  const before = await measure();
  await cell(page, 0, 1).dblclick();
  const editor = page.getByRole("textbox", { name: "Edit name (string)" });
  await expect(editor).toBeVisible();
  const editing = await measure();
  expect(editing.height).toBe(before.height);
  expect(editing.nextTop).toBe(before.nextTop);
  expect(editing.editorFont).toBe(editing.cellFont);
  await editor.press("Alt+Enter");
  await expect
    .poll(async () => (await measure()).height)
    .toBeGreaterThan(before.height);
  await expect(row).toBeVisible();
  await expect(second).toBeVisible();
});

test("an invalid value-bar draft shows a clear error, can be discarded, and does not trap focus", async ({
  page,
}) => {
  await open(
    page,
    '[{"name":"Alpha","tags":["a","b"]},{"name":"Beta","tags":["c"]}]',
  );
  await cell(page, 0, 2).click();
  const bar = page.getByRole("textbox", { name: "Selected cell value" });
  await expect(bar).toHaveValue('["a", "b"]');
  await bar.fill("[1,");
  await bar.press("Enter");
  const alert = page.locator(".value-bar").getByRole("alert");
  await expect(alert).toContainText("valid JSON array");
  // The message sits under the field, left-aligned with it, on one line.
  const [field, message] = await Promise.all([
    bar.boundingBox(),
    alert.boundingBox(),
  ]);
  expect(message!.y).toBeGreaterThanOrEqual(field!.y + field!.height - 1);
  expect(Math.abs(message!.x - field!.x)).toBeLessThanOrEqual(2);
  expect(message!.height).toBeLessThan(28);
  await expect(bar).toHaveAttribute("aria-invalid", "true");
  // Leaving the field with the keyboard is allowed.
  await bar.press("Tab");
  await expect(bar).not.toBeFocused();
  // One visible action restores the stored value.
  await alert.getByRole("button", { name: "Discard change" }).click();
  await expect(bar).toHaveValue('["a", "b"]');
  await expect(alert).toHaveCount(0);
  await cell(page, 1, 1).click();
  await expect(bar).toHaveValue('"Beta"');
});

// Models a large file: Find results arrive well after the click.
async function slowFindResults(page: Page, ms = 900) {
  await page.addInitScript((delay) => {
    const NativeWorker = window.Worker;
    (window as any).Worker = function (...args: any[]) {
      const worker = new (NativeWorker as any)(...args);
      const sent = new Map<number, any>();
      const post = worker.postMessage.bind(worker);
      worker.postMessage = (message: any, ...rest: any[]) => {
        if (message && typeof message.id === "number")
          sent.set(message.id, message);
        return post(message, ...rest);
      };
      let handler: ((e: MessageEvent) => void) | undefined;
      Object.defineProperty(worker, "onmessage", {
        get: () => handler,
        set(next) {
          handler = next;
          worker.addEventListener("message", (e: MessageEvent) => {
            const m = sent.get(e.data?.id);
            sent.delete(e.data?.id);
            const slow = m?.action === "project" && m.args?.search;
            if (slow) setTimeout(() => handler?.call(worker, e), delay);
            else handler?.call(worker, e);
          });
        },
      });
      return worker;
    };
  }, ms);
  await page.reload();
}
const manyRows = () =>
  JSON.stringify(
    Array.from({ length: 400 }, (_, i) => ({
      name: i % 2 ? `odd ${i}` : `even ${i}`,
    })),
  );

test("a cell clicked just after typing in Find stays selected with its value", async ({
  page,
}) => {
  await slowFindResults(page);
  await open(page, manyRows());
  const bar = page.getByRole("textbox", { name: "Selected cell value" });
  await page.locator("#find").fill("even");
  await cell(page, 0, 1).click(); // before the debounced search even starts
  await expect(page.locator(".find-count")).toContainText("200");
  await expect(bar).toHaveValue('"even 0"');
  await cell(page, 1, 1).click();
  await expect(bar).toHaveValue('"even 2"');
});

test("a click on a row that is about to disappear never selects a different row", async ({
  page,
}) => {
  await slowFindResults(page);
  await open(page, manyRows());
  const bar = page.getByRole("textbox", { name: "Selected cell value" });
  await page.locator("#find").fill("odd");
  await page.waitForTimeout(400); // the search is running; the old rows are still shown
  await cell(page, 2, 1).click(); // "even 2": not in the results
  await expect(page.locator(".find-count")).toContainText("200");
  await page.waitForTimeout(300);
  await expect(bar).toHaveCount(0); // nothing is selected, and nothing wrong is
  await cell(page, 1, 1).click();
  await expect(bar).toHaveValue('"odd 3"');
});

test("a row clicked while Find is updating stays selected if it is still in the results", async ({
  page,
}) => {
  await slowFindResults(page);
  await open(page, manyRows());
  const bar = page.getByRole("textbox", { name: "Selected cell value" });
  await page.locator("#find").fill("odd");
  await page.waitForTimeout(400);
  await cell(page, 3, 1).click(); // "odd 3" moves from row 3 to row 1
  await expect(page.locator(".find-count")).toContainText("200");
  await expect(bar).toHaveValue('"odd 3"');
  await expect(cell(page, 1, 1)).toHaveAttribute("aria-selected", "true");
});

test("editing long text starts at its beginning and keeps the caret clear of the edge", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 420 });
  const title =
    "A fairly long title that will not fit inside this narrow column at all";
  await open(page, JSON.stringify([{ title, n: 1 }]));
  const editor = page.locator(".inline-cell");
  await page.getByRole("gridcell", { name: /A fairly long title/ }).dblclick();
  await expect(editor).toBeVisible();
  // The start of the value is what you see first, not its end.
  await expect
    .poll(() => editor.evaluate((e: HTMLTextAreaElement) => e.scrollLeft))
    .toBe(0);
  await page.keyboard.press("End");
  await page.keyboard.type("!");
  // At the end of the text the caret is not flush against the cell border.
  const gap = await editor.evaluate((t: HTMLTextAreaElement) => {
    const cell = t.closest('[role="gridcell"]')!.getBoundingClientRect();
    const box = t.getBoundingClientRect();
    return {
      textareaRight: box.right,
      cellRight: cell.right,
      scrolled: t.scrollLeft,
    };
  });
  expect(gap.scrolled).toBeGreaterThan(0);
  expect(gap.cellRight - gap.textareaRight).toBeGreaterThanOrEqual(6);
});

test("opening a cell for editing and leaving it unchanged never rewrites the file", async ({
  page,
}) => {
  const pretty = JSON.stringify(
    [
      {
        name: "Alpha",
        tags: ["a", "b", "c"],
        meta: { owner: "x", list: [1, 2] },
      },
      { name: "Beta", tags: ["d"], meta: { owner: "y", list: [] } },
    ],
    null,
    2,
  );
  await open(page, pretty);
  const status = page.locator(".status");
  const source = async () => {
    await page.getByRole("button", { name: "Source", exact: true }).click();
    const text = await page.locator(".cm-content").innerText();
    await page.getByRole("button", { name: "Table", exact: true }).click();
    return text.replace(/\u00a0/g, " ");
  };
  const before = await source();
  expect(before).toContain('"tags": [\n      "a",');
  // An array, an object and a string: open the editor, change nothing, commit.
  for (const col of [2, 3, 1]) {
    await cell(page, 0, col).dblclick();
    await expect(page.locator(".inline-cell")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator(".inline-cell")).toHaveCount(0);
    await expect(status).toContainText("Unmodified");
  }
  // Losing focus (for example by dragging a column edge) behaves the same.
  await cell(page, 0, 2).dblclick();
  const edge = await page.locator('[role="columnheader"]').nth(2).boundingBox();
  await page.mouse.move(edge!.x + edge!.width - 2, edge!.y + 10);
  await page.mouse.down();
  await page.mouse.move(edge!.x + edge!.width + 40, edge!.y + 10, { steps: 4 });
  await page.mouse.up();
  await expect(status).toContainText("Unmodified");
  await expect(
    page.getByRole("button", { name: "Review changes" }),
  ).toBeDisabled();
  expect(await source()).toBe(before);
});

test("a value-bar error clears when the draft goes back to the stored value", async ({
  page,
}) => {
  await open(page, '[{"name":"Alpha","meta":{"a":1}}]');
  await cell(page, 0, 2).click();
  const bar = page.getByRole("textbox", { name: "Selected cell value" });
  const error = page.locator(".value-bar-error");
  await expect(bar).toHaveValue('{"a": 1}');
  // Typing the stored value back clears the error at once, and Enter keeps it clear.
  await bar.fill("{broken");
  await bar.press("Enter");
  await expect(error).toBeVisible();
  await bar.fill('{"a": 1}');
  await expect(error).toHaveCount(0);
  await bar.press("Enter");
  await expect(error).toHaveCount(0);
  // A different valid value is committed and clears the error too.
  await bar.fill("{broken");
  await bar.press("Enter");
  await expect(error).toBeVisible();
  await bar.fill('{"a": 2}');
  await bar.press("Enter");
  await expect(error).toHaveCount(0);
  await expect(page.locator(".status")).toContainText("Unsaved changes");
});

test("an invalid in-cell edit explains itself next to the cell", async ({
  page,
}) => {
  await open(page, '[{"name":"Alpha","tags":["a","b"]}]');
  await cell(page, 0, 2).dblclick();
  const editor = page.locator(".inline-cell");
  await editor.fill("[1,");
  await editor.press("Enter");
  const alert = page.getByRole("alert").filter({ hasText: "valid JSON array" });
  await expect(alert).toBeVisible();
  const [cellBox, alertBox] = await Promise.all([
    cell(page, 0, 2).boundingBox(),
    alert.boundingBox(),
  ]);
  // Directly under the cell, lined up with it, and fully on screen.
  expect(alertBox!.y).toBeGreaterThanOrEqual(cellBox!.y + cellBox!.height - 2);
  expect(alertBox!.y - (cellBox!.y + cellBox!.height)).toBeLessThan(24);
  expect(Math.abs(alertBox!.x - cellBox!.x)).toBeLessThanOrEqual(2);
  expect(alertBox!.y + alertBox!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  // It is not tucked away in the status bar any more.
  await expect(page.locator(".status").getByRole("alert")).toHaveCount(0);
  await expect(editor).toHaveAttribute("aria-invalid", "true");
  // Correcting the text removes it.
  await editor.fill('["a"]');
  await expect(alert).toHaveCount(0);
});
