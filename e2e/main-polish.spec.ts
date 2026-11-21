import { expect, test, type Page } from "@playwright/test";
async function open(page: Page, text: string, name = "polish.json") {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open…", exact: true }).click();
  await (
    await chooser
  ).setFiles({ name, mimeType: "application/json", buffer: Buffer.from(text) });
  await expect(page.getByRole("tab", { name, exact: true })).toBeVisible();
}
const cell = (page: Page, row: number, col: number) =>
  page
    .getByRole("grid", { name: "JSON data table" })
    .locator(
      `[role="row"][aria-rowindex="${row + 2}"] [role="gridcell"][aria-colindex="${col + 2}"]`,
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
test("source locator marks exact text without selecting it and wrapping leaves JSON unchanged", async ({
  page,
}) => {
  await open(page, '{"items":[{"name":"Alpha","n":9007199254740993}]}');
  await page.getByRole("button", { name: "items", exact: true }).click();
  await cell(page, 0, 0).click();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(page.locator(".source-cell-location")).toContainText('"Alpha"');
  await expect(page.locator(".source-cell-line-number")).toHaveCount(0);
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("");
  const editor = page.getByRole("textbox", { name: "JSON source draft" });
  const original = await editor.innerText();
  await page.getByRole("button", { name: "Wrap lines", exact: true }).click();
  await expect(page.locator(".source-editor .cm-content")).toHaveClass(
    /cm-lineWrapping/,
  );
  await expect(editor).toHaveText(original);
  await expect(page.locator(".source-actions")).toHaveCount(0);
  const cue = page.locator(".source-cell-arrival");
  for (let repeat = 0; repeat < 2; repeat++) {
    await cue.evaluate((element) =>
      element.getAnimations().forEach((animation) => animation.finish()),
    );
    await page.getByRole("button", { name: /^Selected cell/ }).click();
    await expect
      .poll(() =>
        cue.evaluate((element) =>
          element
            .getAnimations()
            .some((animation) => animation.playState === "running"),
        ),
      )
      .toBe(true);
  }
  await expect(editor).toHaveText(original);
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("");
  await editor.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" ");
  await expect(page.locator(".source-cell-marker")).not.toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Minify", exact: true }),
  ).toBeEnabled();
});
test("formatting keeps exact tokens, remains undoable and explains blocked navigation", async ({
  page,
}) => {
  const raw = '{ "n": 9007199254740993, "huge": 1e400, "s": "a  b" }';
  await open(page, raw);
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page.getByRole("button", { name: "Pretty-print", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "JSON source draft" });
  await expect(editor).toContainText("9007199254740993");
  await expect(page.locator(".source-actions")).toContainText(
    "Apply or discard to switch scope or return to Table",
  );
  await page.getByRole("button", { name: "Minify", exact: true }).click();
  await expect(editor).toHaveText(
    '{"n":9007199254740993,"huge":1e400,"s":"a  b"}',
  );
  await page.keyboard.press("ControlOrMeta+z");
  await expect(editor).toContainText("\n");
  await page.getByRole("button", { name: "Apply source", exact: true }).click();
  await expect(page.locator(".source-actions")).toHaveCount(0);
});
test("filename menu clears text selection and home has project links", async ({
  page,
}) => {
  await expect(
    page.getByRole("link", { name: "Star on GitHub" }),
  ).toHaveAttribute("href", "https://github.com/arsxd/lattice");
  await expect(
    page.getByRole("link", { name: "Support Lattice on Buy Me a Coffee" }),
  ).toHaveAttribute("href", "https://buymeacoffee.com/arshaaad");
  await open(page, '{"a":1}');
  await page.locator(".document-filename").click({ button: "right" });
  await expect(page.locator(".file-location-panel")).toBeVisible();
  await page.locator(".file-location-panel strong").evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.locator(".location").click({ position: { x: 320, y: 12 } });
  await expect(page.locator(".file-location-panel")).not.toBeVisible();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("");
});
test("missing-cell no-op and rejected value-bar edits preserve data", async ({
  page,
}) => {
  await open(page, '[{"n":1},{"other":true}]');
  await cell(page, 1, 0).dblclick();
  await page.keyboard.press("Enter");
  await expect(cell(page, 1, 0)).toHaveClass(/missing-property-cell/);
  await cell(page, 0, 0).click();
  const bar = page.getByRole("textbox", {
    name: "Selected cell value",
    exact: true,
  });
  await expect(bar).toHaveValue("1");
  await bar.fill("not a number");
  await cell(page, 1, 0).click();
  await expect(bar).toHaveValue("not a number");
  await expect(page.getByRole("alert")).toContainText("Enter a number");
});

test("array previews wrap only overflowing rows and Find counts matching cells", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1050, height: 800 });
  await open(
    page,
    JSON.stringify({
      short: [337184283],
      long: Array.from({ length: 30 }, (_, n) => 337184200 + n),
    }),
  );
  const short = cell(page, 0, 1);
  const long = cell(page, 1, 1);
  const normal = (await short.boundingBox())!.height;
  await page.getByRole("button", { name: "Wrap text", exact: true }).click();
  await expect
    .poll(async () => (await long.boundingBox())!.height)
    .toBeGreaterThan(normal);
  expect((await short.boundingBox())!.height).toBe(normal);
  await open(
    page,
    '[{"name":"Alpha"},{"name":"alpha"},{"name":"Alphabet"}]',
    "search.json",
  );
  await page
    .getByRole("searchbox", { name: "Find in table", exact: true })
    .fill("Alpha");
  await expect(page.locator(".find-count")).toHaveText("3 cells");
  await page.getByRole("button", { name: "Match case", exact: true }).click();
  await expect(page.locator(".find-count")).toHaveText("2 cells");
  await page
    .getByRole("button", { name: "Match whole word", exact: true })
    .click();
  await expect(page.locator(".find-count")).toHaveText("1 cell");
});

test("compact formatting keeps short records inline, stays undoable and rejects invalid drafts", async ({
  page,
}) => {
  const raw =
    '{ "record": { "n":9007199254740993,"huge":1e400,"s":"\\u0061" }, "enabled":true }';
  await open(page, raw);
  await page.getByRole("button", { name: "Source", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "JSON source draft" });
  await page.getByRole("button", { name: "Compact", exact: true }).click();
  await expect(editor).toContainText(
    '"record": { "n": 9007199254740993, "huge": 1e400, "s": "\\u0061" }',
  );
  const formatted = await editor.innerText();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(editor).toHaveText(raw);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(() => editor.innerText()).toBe(formatted);
  await expect(page.locator(".source-actions")).toBeVisible();
  await editor.fill('{"unfinished":');
  await expect(editor).toHaveText('{"unfinished":');
  await page.getByRole("button", { name: "Compact", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Correct the JSON before formatting",
  );
  await expect(editor).toHaveText('{"unfinished":');
});

test("format labels have keyboard and hover explanations without changing focus", async ({
  page,
}) => {
  await open(page, '{"value":1}');
  await page.getByRole("button", { name: "Source", exact: true }).click();
  const formats = page.getByRole("group", { name: "Format", exact: true });
  const expanded = formats.getByRole("button", {
    name: "Pretty-print",
    exact: true,
  });
  await expanded.focus();
  await expect(page.getByRole("tooltip")).toContainText("separate lines");
  await expanded.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(expanded).toBeFocused();
  await formats.getByRole("button", { name: "Compact", exact: true }).hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "short objects and arrays inline",
  );
  await page.mouse.move(0, 0);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(
    formats.getByRole("button", { name: "Minify", exact: true }),
  ).not.toHaveAttribute("aria-pressed");
});

test("Source pairs JSON characters and retains typing through Undo/Redo", async ({
  page,
}) => {
  await open(page, '{"name":"Alpha"}');
  await page.getByRole("button", { name: "Source", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "JSON source draft" });
  await editor.fill("");
  await page.keyboard.type('"');
  await expect(editor).toHaveText('""');
  await page.keyboard.press("Backspace");
  await expect(editor).toHaveText("");
  await page.keyboard.type('{"name": ["value"]}');
  await expect(editor).toHaveText('{"name": ["value"]}');
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(editor).toHaveText('{"name": ["value"]}');
});
