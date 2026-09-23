// End-to-end tests.
//
// This covers what Vitest can't: async Server Components and anything that
// depends on Next's real routing (redirects, 404s, URL params).
//
// A trace is kept for every failure: `pnpm exec playwright show-trace` opens
// the viewer with DOM, network and console step by step.
//
// Browsers are not bundled: run `pnpm exec playwright install chromium` once.

import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Playwright doesn't read env files on its own; the app it boots needs the
// database and auth variables. Same precedence as Next: .env.local first.
config({ path: [".env.local", ".env"], quiet: true });

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // A forgotten .only in CI silently turns off the rest of the suite.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // One `next dev` process sits on the other side, and it compiles on demand.
  // A few workers keep heavy tests from timing out under contention.
  workers: process.env.CI ? 1 : 3,
  // `timeout` is the whole test; `expect.timeout` is each retrying assertion.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    // Locally, reuse the server you already have running; in CI, always a new one.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
