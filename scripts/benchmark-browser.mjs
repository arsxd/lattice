import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { performance } from "node:perf_hooks";
import { cpus, platform, arch } from "node:os";
import { mkdirSync, writeFileSync } from "node:fs";

// Run against a production preview, never a dev/HMR server. No user files.
const url = process.env.LATTICE_BENCH_URL ?? "http://127.0.0.1:1424/";
const runs = Number(process.env.LATTICE_BENCH_RUNS ?? 3);
const sizes = (process.env.LATTICE_BENCH_MIB ?? "1,5,25")
  .split(",")
  .map(Number);
if (
  !Number.isInteger(runs) ||
  runs < 1 ||
  runs > 10 ||
  sizes.some((n) => !Number.isFinite(n) || n < 0.1 || n > 60)
)
  throw Error("Use 1–10 runs and fixture sizes between 0.1 and 60 MiB.");
const browser = await chromium.launch();
const results = [];
mkdirSync("output/verification", { recursive: true });
try {
  for (const mib of sizes) {
    const record = JSON.stringify({
      name: "Sample product",
      price: 12.5,
      available: true,
      tags: ["paper", "gift"],
      description: "Generic synthetic benchmark record. ".repeat(4),
      details: { rating: 4.5, stock: 20 },
    });
    const count = Math.floor((mib * 1024 * 1024) / (record.length + 1));
    const text = '{"records":[' + Array(count).fill(record).join(",") + "]}";
    const fixture = new URL(
      `../output/verification/benchmark-${mib}mib.json`,
      import.meta.url,
    );
    writeFileSync(fixture, text);
    for (let run = 1; run <= runs; run++) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        Object.defineProperty(window, "showOpenFilePicker", {
          value: undefined,
          configurable: true,
        });
        window.benchmarkTasks = [];
        new PerformanceObserver((list) =>
          window.benchmarkTasks.push(
            ...list
              .getEntries()
              .map((e) => ({ start: e.startTime, duration: e.duration })),
          ),
        ).observe({ type: "longtask", buffered: true });
      });
      await page.goto(url);
      const timings = {};
      const measure = async (name, action) => {
        const start = performance.now();
        await action();
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        timings[name] = Math.round(performance.now() - start);
      };
      const grid = page.getByRole("grid", { name: "JSON data table" });
      const cell = (row, column) =>
        grid.locator(
          `[role="row"][aria-rowindex="${row + 2}"] [role="gridcell"][aria-colindex="${column + 2}"]`,
        );
      await measure("openMs", async () => {
        const chooser = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: "Open…", exact: true }).click();
        await (await chooser).setFiles(fileURLToPath(fixture));
        await grid.waitFor();
      });
      await measure("navigateMs", async () => {
        // The single-container root may already be opened by initial sheet selection.
        const records = page.getByRole("gridcell", {
          name: "records",
          exact: true,
        });
        if (await records.count()) await records.dblclick();
        await page
          .getByRole("button", { name: "Select column price", exact: true })
          .waitFor();
      });
      await measure("selectMs", async () => {
        await cell(0, 1).click();
        await expect(
          page.getByRole("textbox", { name: "Selected cell value" }),
        ).toHaveValue("Sample product");
      });
      await measure("editMs", async () => {
        await cell(0, 2).dblclick();
        const editor = page.getByRole("textbox", {
          name: "Edit price (number)",
        });
        await editor.fill("19.75");
        await editor.press("Enter");
        await expect(cell(0, 2)).toHaveText("19.75");
      });
      await measure("sortMs", async () => {
        await page
          .getByRole("button", { name: "Sort and filter price", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Sort ascending ↑", exact: true })
          .click();
        await expect(cell(0, 2)).toHaveText("12.5", { timeout: 30000 });
      });
      const tasks = await page.evaluate(() => window.benchmarkTasks);
      results.push({
        mib,
        bytes: Buffer.byteLength(text),
        rows: count,
        run,
        ...timings,
        longTasks: tasks.length,
        longestTaskMs: Math.round(Math.max(0, ...tasks.map((t) => t.duration))),
        renderedCells: await grid.getByRole("gridcell").count(),
        errors,
      });
      console.log(JSON.stringify(results.at(-1)));
      if (errors.length) throw Error(errors.join("\n"));
      await page.close();
    }
  }
} finally {
  const report = {
    date: new Date().toISOString(),
    environment: {
      os: platform(),
      arch: arch(),
      cpu: cpus()[0].model,
      node: process.version,
      browser: browser.version(),
      viewport: "1440x900",
      throttling: "none",
    },
    note: "Synthetic local production Chromium workflows, wall time includes automation and two animation frames. Reused browser, fresh page per run; warm app assets. Long tasks cover the whole page lifetime including startup, not worker execution. No machine-wide or browser memory claim. Not a maximum-size or responsiveness guarantee.",
    results,
  };
  mkdirSync("output/verification", { recursive: true });
  writeFileSync(
    "output/verification/browser-benchmark.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
