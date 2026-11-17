import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const directory = "output/nesting-audit";
const manifest = JSON.parse(readFileSync(`${directory}/manifest.json`, "utf8"));
mkdirSync(`${directory}/screenshots`, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  Object.defineProperty(window, "showOpenFilePicker", {
    value: undefined,
    configurable: true,
  });
  localStorage.setItem("lattice-show-nested-data", "false");
});
page.on("dialog", (d) => d.accept());
let current;
const failures = [],
  results = [];
page.on("pageerror", (error) =>
  failures.push({ id: current, error: error.message }),
);
const gallery = new Set([
  "distinct-dictionaries",
  "partial-overlap",
  "deep-dictionaries",
  "random-22",
  "child-arrays",
  "heterogeneous-records",
  "empty-and-missing",
  "special-keys",
]);
for (const fixture of manifest) {
  current = fixture.id;
  const start = performance.now(),
    result = { id: current, category: fixture.category };
  try {
    await page.goto(pathToFileURL(resolve("output/Lattice-Offline.html")).href);
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Open JSON file…", exact: true })
      .click();
    await (await chooser).setFiles(resolve(directory, fixture.file));
    if (fixture.expectedInvalid) {
      await page
        .getByRole("alert")
        .filter({ hasText: /depth|nesting/i })
        .waitFor({ timeout: 5000 });
      result.mode = "expected-rejection";
      results.push(result);
      continue;
    }
    await page
      .getByRole("tab", { name: `${fixture.id}.json`, exact: true })
      .waitFor({ timeout: 5000 });
    await page
      .getByRole("checkbox", { name: "Show nested data", exact: true })
      .check();
    await page.waitForFunction(
      () =>
        document.querySelector(".expanded-grid table") ||
        document.querySelector(".data-grid") ||
        document.querySelector(".empty-table"),
      null,
      { timeout: 5000 },
    );
    await page.waitForFunction(
      () => {
        const table = document.querySelector(
          '.expanded-section[data-active="true"] table',
        );
        if (!table) return true;
        const rows = table.querySelectorAll("tbody tr").length;
        const columns = table.querySelectorAll("col").length - 1;
        return document
          .querySelector(".status .selection-status")
          ?.textContent?.includes(
            `${rows.toLocaleString()} rows · ${columns} columns`,
          );
      },
      null,
      { timeout: 5000 },
    );
    const geometry = await page.evaluate(() => {
      const tables = [...document.querySelectorAll(".expanded-grid table")];
      const footer = document
        .querySelector(".expanded-toolbar-host")
        ?.getBoundingClientRect();
      const tabs = document
        .querySelector(".sheet-tabs")
        ?.getBoundingClientRect();
      return {
        tables: tables.map((t) => ({
          label: t.getAttribute("aria-label"),
          rows: t.querySelectorAll("tbody tr").length,
          columns: t.querySelectorAll("col").length - 1,
        })),
        actionBars: document.querySelectorAll(".expanded-sheets .pagination")
          .length,
        footerGap: footer && tabs ? Math.abs(footer.bottom - tabs.top) : null,
        pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        fallback: document.querySelector(".nested-view-notice") !== null,
      };
    });
    if (geometry.tables.some((t) => t.rows > 500 || t.columns > 200))
      throw Error("Expanded rendering exceeds bounds");
    if (geometry.tables.length && geometry.actionBars !== 1)
      throw Error("Nested view does not have exactly one action bar");
    if (geometry.footerGap !== null && geometry.footerGap > 2)
      throw Error(
        `Action footer separated from tabs by ${geometry.footerGap}px`,
      );
    if (geometry.pageOverflow)
      throw Error("Workspace causes whole-page horizontal overflow");
    result.mode = geometry.tables.length
      ? "expanded"
      : geometry.fallback
        ? "fallback"
        : "regular";
    Object.assign(result, geometry);
    if (
      fixture.focusPaths?.some(
        (path) => JSON.stringify(path) === '["smallSection"]',
      )
    ) {
      await page
        .getByRole("navigation", { name: "Document sheets" })
        .getByRole("button", { name: "smallSection", exact: true })
        .click();
      await page
        .getByRole("table", { name: "properties data", exact: true })
        .waitFor({ timeout: 5000 });
      result.smallSectionExpanded = true;
    }
    if (gallery.has(fixture.id))
      await page.screenshot({
        path: `${directory}/screenshots/${fixture.id}.png`,
      });
  } catch (error) {
    result.error = error.message;
    failures.push({ id: current, error: error.message });
  }
  result.elapsedMs = Math.round(performance.now() - start);
  results.push(result);
}
const report = {
  artifactSha256: createHash("sha256")
    .update(readFileSync("output/Lattice-Offline.html"))
    .digest("hex"),
  version: JSON.parse(readFileSync("package.json", "utf8")).version,
  scope:
    "Headless Chromium on the local machine, released standalone HTML. Generated fixtures were opened and rendered; browser-wide geometry and errors checked. Editing integrity is covered by the separate engine audit and release regression suite, not by every render case here.",
  generatedAt: new Date().toISOString(),
  fixtures: manifest.length,
  failures,
  results,
};
writeFileSync(
  `${directory}/browser-report.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      fixtures: manifest.length,
      failures,
      views: results.reduce(
        (all, r) => ((all[r.mode] = (all[r.mode] ?? 0) + 1), all),
        {},
      ),
    },
    null,
    2,
  ),
);
await browser.close();
if (failures.length) process.exitCode = 1;
