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
const geometry = (page: Page, selector = ".sheet-tabs") =>
  page.evaluate((selector) => {
    const strip = document.querySelector(selector) as HTMLElement;
    const style = getComputedStyle(strip);
    const borders =
      parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const tab = strip.querySelector("button")!.getBoundingClientRect();
    return {
      overflowing: strip.scrollWidth > strip.clientWidth,
      scrollbar: strip.offsetHeight - strip.clientHeight - borders,
      gapBelowTabs: strip.getBoundingClientRect().bottom - tab.bottom,
    };
  }, selector);

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

test("a scrollbar that takes no space does not cover the sheet tab names", async ({
  page,
}) => {
  // Overlay scrollbars (macOS trackpads) are drawn over content and add no
  // height. CI browsers cannot be forced into that mode, so emulate it.
  await openManySheets(page);
  await page.addStyleTag({
    content: ".sheet-tabs { scrollbar-width: none; }",
  });
  await expect
    .poll(async () => (await geometry(page)).gapBelowTabs)
    .toBeGreaterThanOrEqual(8);
  const g = await geometry(page);
  expect(g.overflowing).toBe(true);
  expect(g.scrollbar).toBeLessThan(2);
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

test("overflow scroll arrows keep top document tabs usable without a scrollbar", async ({
  page,
}) => {
  await openManySheets(page);
  const earlier = page.getByRole("button", {
    name: "Scroll to earlier document tabs",
  });
  const later = page.getByRole("button", {
    name: "Scroll to later document tabs",
  });
  await expect(earlier).toHaveCount(0);
  await expect(later).toHaveCount(0);

  for (let i = 1; i <= 6; i++) {
    const name = `another-long-document-filename-${i}.json`;
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Open…", exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name,
      mimeType: "application/json",
      buffer: Buffer.from('{"count":1}'),
    });
    await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  }

  const strip = page.locator(".document-tabs");
  await expect(strip).toHaveCSS("scrollbar-width", "none");
  await expect(earlier).toBeEnabled();
  await expect(later).toBeDisabled();
  const g = await geometry(page, ".document-tabs");
  expect(g.overflowing).toBe(true);
  expect(g.gapBelowTabs).toBe(0);

  const before = await strip.evaluate((element) => element.scrollLeft);
  await earlier.click();
  await expect
    .poll(() => strip.evaluate((element) => element.scrollLeft))
    .toBeLessThan(before);
  await expect(later).toBeEnabled();
  await expect(
    page.getByRole("tab", {
      name: "another-long-document-filename-6.json",
      exact: true,
    }),
  ).toHaveAttribute("aria-selected", "true");
});
