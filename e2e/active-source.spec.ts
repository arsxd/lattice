import { test, expect } from "@playwright/test";
test("active Source retains full contrast while unavailable Table stays dimmed", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try sample" }).click();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  const source = page.getByRole("button", { name: "Source", exact: true });
  await expect(source).toHaveAttribute("aria-pressed", "true");
  await expect(source).toHaveCSS("opacity", "1");
  const editor = page.getByRole("textbox", { name: "JSON source draft" });
  await editor.press("End");
  await editor.press("Space");
  await expect(
    page.getByRole("button", { name: "Table", exact: true }),
  ).toBeDisabled();
  await expect(source).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await expect(source).toHaveCSS("opacity", "1");
});
