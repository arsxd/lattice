import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";

test("standalone HTML edits, undoes, exports and reopens exact JSON without network access", async ({
  page,
  context,
}, testInfo) => {
  const original =
    '\ufeff[\r\n  {"name":"Alpha","precise":9007199254740993,"huge":1e400,"escaped":"\\u0061"}\r\n]\r\n';
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "showSaveFilePicker", {
      value: undefined,
      configurable: true,
    });
  });
  await context.setOffline(true);
  await page.goto(pathToFileURL(resolve("output/Lattice-Offline.html")).href);
  await expect(
    page.getByRole("heading", {
      name: "Edit JSON like a spreadsheet.",
      exact: true,
    }),
  ).toBeVisible();
  const open = async (
    file: { name: string; mimeType: string; buffer: Buffer } | string,
  ) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Open…", exact: true }).click();
    await (await chooser).setFiles(file);
    await page.getByRole("grid", { name: "JSON data table" }).waitFor();
  };
  await open({
    name: "round-trip.json",
    mimeType: "application/json",
    buffer: Buffer.from(original),
  });
  const cell = page
    .getByRole("grid", { name: "JSON data table" })
    .locator(
      '[role="row"][aria-rowindex="2"] [role="gridcell"][aria-colindex="3"]',
    );
  await cell.dblclick();
  const editor = page.getByRole("textbox", { name: "Edit name (string)" });
  await editor.fill("Changed");
  await editor.press("Enter");
  await expect(cell).toHaveText("Changed");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(cell).toHaveText("Alpha");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(cell).toHaveText("Changed");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const output = testInfo.outputPath("round-trip.json");
  await (await download).saveAs(output);
  expect(await readFile(output, "utf8")).toBe(
    original.replace("Alpha", "Changed"),
  );
  await expect(page.locator(".status")).toContainText("Unsaved changes");
  await open(output);
  await expect(cell).toHaveText("Changed");
  expect(requests).toEqual([]);
  expect(await page.locator("#project-license").textContent()).toContain(
    "Permission to use, copy, modify",
  );
  expect(await page.locator("#third-party-notices").textContent()).toContain(
    "react@",
  );
  expect(await page.locator("#third-party-notices").textContent()).toContain(
    "jsonc-parser@",
  );
});
