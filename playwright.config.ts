import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:1422",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  webServer: {
    command:
      "npm run pwa:build && npm run web:preview -- --port 1422 --strictPort",
    url: "http://127.0.0.1:1422",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
