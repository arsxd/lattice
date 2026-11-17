import { chromium } from "@playwright/test";
import { strict as assert } from "node:assert";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
const html = await readFile("output/Lattice-Grouped-Preview.html", "utf8");
assert(html.includes("Permission to use, copy, modify"));
assert(html.includes("third-party") || html.includes("Third-party"));
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    pathToFileURL(resolve("output/Lattice-Grouped-Preview.html")).href,
  );
  await page.getByRole("table").waitFor();
  assert.equal(await page.locator('td[rowspan="2"]').count(), 6);
  await page.getByRole("button", { name: "product", exact: true }).click();
  await page.getByRole("searchbox", { name: "Filter values" }).fill("Monitor");
  assert.equal(await page.locator("tbody").count(), 1);
  assert.equal(
    await page
      .locator("tbody")
      .innerText()
      .then((text) => text.includes("SO-1042")),
    true,
  );
  await page.getByRole("searchbox").fill("");
  await page
    .getByRole("textbox", { name: "Child array name" })
    .fill("shipments");
  await page.getByRole("button", { name: "Show child array" }).click();
  assert.equal(await page.locator("tbody").count(), 3);
  assert.equal(
    await page
      .locator("thead")
      .innerText()
      .then((text) => text.includes("carrier")),
    true,
  );
  await page.getByRole("textbox", { name: "Child array name" }).fill("items");
  await page.getByRole("button", { name: "Show child array" }).click();
  await page.screenshot({ path: "output/grouped-preview.png", fullPage: true });
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "exact.json",
      mimeType: "application/json",
      buffer: Buffer.from('[{"name":"A","items":[{"n":9007199254740993}]}]'),
    });
  await page
    .getByRole("cell", { name: "9007199254740993", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Grouped preview: offline opening, shared cells, scoped sorting/filtering, sibling-array switching, exact numbers and console checks passed.",
  );
} finally {
  await browser.close();
}
