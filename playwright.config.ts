import { defineConfig, devices } from "@playwright/test";

/**
 * Nav smoke tests — verify every previously-linked route is still reachable
 * from at least one nav surface after the sidebar deduplication.
 *
 * BASE_URL defaults to http://localhost:8081 (the chroma Vite dev server port
 * as wired in .replit).  Override with the BASE_URL env var when needed.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 20_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:20649",
    // Cookie-based session auth works over http localhost
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
