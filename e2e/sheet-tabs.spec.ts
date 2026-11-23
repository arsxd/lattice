import { chromium, expect, test, type Page } from "@playwright/test";

async function openManySheets(page: Page) {
  await page.addInitScript(() =>
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.setViewportSize({ width: 900, height: 420 });
  await page.goto("/");
  const doc: Record<string, unknown> = {};
  for (let i = 1; i <= 24; i++) doc[`sheet_number_${i}`] = [{ id: i }];
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open…", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "many.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(doc)),
  });
  await page.getByRole("grid", { name: "JSON data table" }).waitFor();
}
const geometry = (page: Page) =>
  page.evaluate(() => {
    const strip = document.querySelector(".sheet-tabs") as HTMLElement;
    const style = getComputedStyle(strip);
    const borders =
      parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const tab = strip.querySelector("button")!.getBoundingClientRect();
    return {
      overflowing: strip.scrollWidth > strip.clientWidth,
      scrollbar: strip.offsetHeight - strip.clientHeight - borders,
      gapBelowTabs: strip.getBoundingClientRect().bottom - tab.bottom,
    };
  });

// Real scrollbars: headless Chromium hides them by default, and "overlay" bars
// (macOS trackpads) behave differently from classic ones (Windows).
async function withScrollbars(
  kind: "overlay" | "classic",
  run: (page: Page) => Promise<void>,
) {
  const browser = await chromium.launch({
    ignoreDefaultArgs: ["--hide-scrollbars"],
    args: [
      kind === "overlay"
        ? "--enable-features=OverlayScrollbar"
        : "--disable-features=OverlayScrollbar",
    ],
  });
  try {
    const page = await browser.newPage({
      baseURL: test.info().project.use.baseURL,
    });
    await run(page);
  } finally {
    await browser.close();
  }
}

test("overlay scrollbars do not cover the sheet tab names", async () => {
  await withScrollbars("overlay", async (page) => {
    await openManySheets(page);
    await expect
      .poll(async () => (await geometry(page)).overflowing)
      .toBe(true);
    const g = await geometry(page);
    expect(g.scrollbar).toBeLessThan(2); // overlay bars take no space
    expect(g.gapBelowTabs).toBeGreaterThanOrEqual(8);
  });
});

test("classic scrollbars sit below the tabs without extra spacing", async () => {
  await withScrollbars("classic", async (page) => {
    await openManySheets(page);
    await expect
      .poll(async () => (await geometry(page)).overflowing)
      .toBe(true);
    const g = await geometry(page);
    expect(g.scrollbar).toBeGreaterThan(8);
    expect(g.gapBelowTabs).toBe(g.scrollbar);
  });
});

test("a short sheet list keeps the compact strip", async ({ page }) => {
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
    name: "few.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"a":[{"x":1}],"b":[{"x":2}]}'),
  });
  await page.getByRole("grid", { name: "JSON data table" }).waitFor();
  const g = await geometry(page);
  expect(g.overflowing).toBe(false);
  expect(g.gapBelowTabs).toBe(0);
});
