import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const AUTH = "e2e/.auth/manager.json";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // One production server renders pages and PDFs for every worker; more workers only add queueing.
  workers: process.env.CI ? 2 : 4,
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // Snapshots are created on first run and compared after that.
  updateSnapshots: "missing",
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled" } },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    // Signs in once as the demo account manager; every other test starts from that session.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 960 }, storageState: AUTH },
      dependencies: ["setup"],
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], storageState: AUTH },
      dependencies: ["setup"],
      testIgnore: /(pdf|flow|a11y)\.spec/,
    },
  ],
  webServer: {
    command: `npm run start -w @reportpilot/web -- --port ${PORT}`,
    url: `http://localhost:${PORT}/sign-in`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { NEXT_DIST_DIR: process.env.NEXT_DIST_DIR ?? ".next", EMAIL_MODE: "test" },
  },
});
