import { test, expect, type Page } from "@playwright/test";

const original =
  '\ufeff[\r\n  {"name":"Alpha","precise":9007199254740993,"huge":1e400,"escaped":"\\u0061"}\r\n]\r\n';

async function linkedFile(page: Page) {
  // Models the browser handle contract; it does not test native permission dialogs.
  await page.addInitScript((text) => {
    localStorage.setItem("lattice-show-index", "true");
    const model = {
      disk: text,
      writes: 0,
      aborts: 0,
      failClose: false,
    };
    (window as any).fileModel = model;
    const handle = {
      name: "round-trip.json",
      getFile: async () =>
        new File([model.disk], "round-trip.json", { type: "application/json" }),
      createWritable: async () => {
        let staged = "";
        return {
          write: async (value: string) => {
            staged = value;
          },
          close: async () => {
            if (model.failClose) throw Error("Simulated storage failure");
            model.disk = staged;
            model.writes++;
          },
          abort: async () => {
            model.aborts++;
          },
        };
      },
    };
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      value: async () => [handle],
    });
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: async () => {
        throw new DOMException("Cancelled", "AbortError");
      },
    });
  }, original);
  await page.goto("/");
  await page.getByRole("button", { name: "Open…", exact: true }).click();
  await page.getByRole("grid", { name: "JSON data table" }).waitFor();
}
const nameCell = (page: Page) =>
  page
    .getByRole("grid", { name: "JSON data table" })
    .locator(
      '[role="row"][aria-rowindex="2"] [role="gridcell"][aria-colindex="3"]',
    );
async function editName(page: Page, value: string) {
  await nameCell(page).dblclick();
  const editor = page.getByRole("textbox", { name: "Edit name (string)" });
  await editor.fill(value);
  await editor.press("Enter");
  await expect(nameCell(page)).toHaveText(value);
}

test("linked Save preserves exact JSON spelling and cancelled Save as retains dirty edits", async ({
  page,
}) => {
  await linkedFile(page);
  await editName(page, "Changed");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".status")).toContainText("Unmodified");
  expect(await page.evaluate(() => (window as any).fileModel.disk)).toBe(
    original.replace("Alpha", "Changed"),
  );
  await editName(page, "Unsaved");
  await page.getByRole("button", { name: "Save as…", exact: true }).click();
  await expect(page.locator(".status")).toContainText("Unsaved changes");
  expect(await page.evaluate(() => (window as any).fileModel.disk)).toBe(
    original.replace("Alpha", "Changed"),
  );
  await expect(nameCell(page)).toHaveText("Unsaved");
});

test("external changes block linked Save and Reload adopts the external file", async ({
  page,
}) => {
  await linkedFile(page);
  await editName(page, "Mine");
  const external = '[{"name":"External","precise":9007199254740993}]';
  await page.evaluate((text) => {
    (window as any).fileModel.disk = text;
  }, external);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "changed in another editor",
  );
  expect(await page.evaluate(() => (window as any).fileModel.writes)).toBe(0);
  await expect(page.locator(".status")).toContainText("Unsaved changes");
  await page
    .getByRole("button", { name: /^Reload source…?$/, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(nameCell(page)).toHaveText("External");
  await expect(page.locator(".status")).toContainText("Unmodified");
  expect(await page.evaluate(() => (window as any).fileModel.disk)).toBe(
    external,
  );
});

test("a failed linked Save aborts the writer and keeps the draft retryable", async ({
  page,
}) => {
  await linkedFile(page);
  await editName(page, "Changed");
  await page.evaluate(() => {
    (window as any).fileModel.failClose = true;
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Simulated storage failure",
  );
  await expect(page.locator(".status")).toContainText("Unsaved changes");
  expect(await page.evaluate(() => (window as any).fileModel.disk)).toBe(
    original,
  );
  expect(await page.evaluate(() => (window as any).fileModel.aborts)).toBe(1);
  await page.evaluate(() => {
    (window as any).fileModel.failClose = false;
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".status")).toContainText("Unmodified");
  expect(await page.evaluate(() => (window as any).fileModel.disk)).toBe(
    original.replace("Alpha", "Changed"),
  );
});
