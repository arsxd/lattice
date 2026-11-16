import { test, expect } from "@playwright/test";

test("small tables keep their last column content-sized in a wide window", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.addInitScript(() =>
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/");
  const fixtures = [
    '{"large_id":9007199254740993,"large_exponent":1e400,"negative_zero":-0,"decimal":0.123456789012345678901}',
    "[100,200,300]",
    '[{"price":12.5},{"price":24.5}]',
    "42",
  ];
  let resizedValue = 0;
  for (const [index, text] of fixtures.entries()) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Open…", exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name: `width-${index}.json`,
      mimeType: "application/json",
      buffer: Buffer.from(text),
    });
    await expect(
      page.getByRole("tab", { name: `width-${index}.json`, exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    const grid = page.getByRole("grid", { name: "JSON data table" });
    await grid.waitFor();
    const last = grid.getByRole("columnheader").last();
    await expect
      .poll(async () => (await last.boundingBox())!.width)
      .toBeLessThanOrEqual(280);
    const bounds = (await last.boundingBox())!;
    const viewport = (await grid.boundingBox())!;
    expect(bounds.x + bounds.width).toBeLessThan(
      viewport.x + viewport.width - 500,
    );
    if (index === 0)
      await expect(
        grid.getByRole("gridcell", { name: "9007199254740993", exact: true }),
      ).toBeVisible();
    if (index === 0) {
      const decimal = grid
        .getByRole("gridcell", { name: "0.123456789012345678901", exact: true })
        .locator(".cell-value");
      expect(
        await decimal.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
      ).toBeLessThanOrEqual(1);
      await page.mouse.move(
        bounds.x + bounds.width - 2,
        bounds.y + bounds.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        bounds.x + bounds.width + 120,
        bounds.y + bounds.height / 2,
        { steps: 5 },
      );
      await page.mouse.up();
      await expect
        .poll(async () => (await last.boundingBox())!.width)
        .toBeGreaterThan(bounds.width + 100);
      const resized = (await last.boundingBox())!.width;
      resizedValue = resized;
      await page.setViewportSize({ width: 2040, height: 1000 });
      await expect
        .poll(async () => (await last.boundingBox())!.width)
        .toBe(resized);
    }
  }
  await page.getByRole("tab", { name: "width-0.json", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await page
          .getByRole("grid", { name: "JSON data table" })
          .getByRole("columnheader")
          .last()
          .boundingBox())!.width,
    )
    .toBe(resizedValue);
});
