import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e", forbidOnly: !!process.env.CI, retries: 0,
  workers: process.env.CI ? 2 : undefined, timeout: 30000,
  reporter: [["list"], ["html", { open: "never" }], ["junit", { outputFile: "reports/e2e.xml" }]],
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: "npm run start -- --hostname 127.0.0.1", url: "http://127.0.0.1:3000/login", reuseExistingServer: !process.env.CI, timeout: 120000 },
});
