import { defineConfig, devices } from "@playwright/test";

/**
 * Nav smoke tests — verify every route is still reachable after the flat
 * top-nav + contextual sidebar refactor.
 *
 * BASE_URL defaults to the Vite dev-server port configured in artifact.toml.
 * Override with the BASE_URL env var when needed.
 *
 * Chromium binary: pointed at the Nix-store playwright-browsers package so
 * the tests work without a separate `npx playwright install` step.
 */

const CHROMIUM_EXEC =
  "/nix/store/0n9rl5l9syy808xi9bk4f6dhnfrvhkww-playwright-browsers-chromium/chromium-1080/chrome-linux/chrome";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 20_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:20649",
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { executablePath: CHROMIUM_EXEC },
      },
    },
  ],
});
