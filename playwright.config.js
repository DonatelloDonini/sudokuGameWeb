import { defineConfig, devices } from "@playwright/test";
import { E2E_PORT } from "./tests/e2e/config.js";

/**
 * Browser tests of the whole game: tests/e2e/server.js starts the real server on a fresh database.
 * They run one at a time, because the battles match whoever is looking for an opponent.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {timeout: 10_000},
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", {open: "never"}]] : [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node --disable-warning=ExperimentalWarning tests/e2e/server.js",
    url: `http://127.0.0.1:${E2E_PORT}/api/health`,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 30_000,
  },
  projects: [
    {
      name: "desktop",
      use: {...devices["Desktop Chrome"], viewport: {width: 1366, height: 860}},
    },
    {
      // the phone layout and touch input, on the pages a phone player uses
      name: "mobile",
      use: {...devices["Pixel 7"]},
      testMatch: ["layout.spec.js", "solo.spec.js", "landing.spec.js", "offline.spec.js"],
    },
  ],
});
