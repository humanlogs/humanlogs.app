import { defineConfig, devices } from "@playwright/test";
import { E2E_APP_PORT, baseURL } from "./tests/e2e/config";

/**
 * End-to-end suite. Where Vitest covers the collaboration *protocol*, Playwright
 * covers what a user actually experiences: two people in the same transcript,
 * typing at once, seeing each other's carets, with the real editor, the real
 * Socket.io server and a real database in between.
 *
 * `tests/e2e/serve.ts` boots an ephemeral PostgreSQL (PGlite) and the app's own
 * custom server, so `npx playwright test` needs no external service.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // Collaboration tests drive two browser contexts and wait on network sync.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The suite shares one app + one database; parallel workers would race on the
  // fixtures they seed.
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Escape hatch for environments that ship their own Chromium (sandboxes,
        // locked-down CI images) instead of the build Playwright downloads:
        //   PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium npx playwright test
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
          : {},
      },
    },
  ],
  webServer: {
    command: "npx tsx tests/e2e/serve.ts",
    url: `${baseURL}/app/login`,
    reuseExistingServer: !process.env.CI,
    // Cold start = PGlite boot + `prisma db push` + Next dev compiling the app.
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
    env: { E2E_APP_PORT: String(E2E_APP_PORT) },
  },
});
