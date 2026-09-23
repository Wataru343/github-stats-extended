import { defineConfig } from "@playwright/test";

const executablePath = process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"];

export default defineConfig({
  testDir: ".",
  testMatch: "*.browser.spec.ts",
  workers: 1,
  use: {
    headless: true,
    locale: "en-US",
    timezoneId: "UTC",
    launchOptions: executablePath ? { executablePath } : {},
  },
});
