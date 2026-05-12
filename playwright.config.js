// @ts-check
'use strict';

const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for E2E tests against the pre-built static output.
 *
 * Prerequisites before running tests:
 *   ASPNETCORE_ENVIRONMENT=Production dotnet run   (generates ./output/)
 *
 * Local run:
 *   npm run test:e2e
 *
 * CI run (Chromium + Firefox):
 *   npx playwright test --project=chromium --project=firefox
 */
module.exports = defineConfig({
  testDir: './tests/e2e',

  // Run tests within each file in parallel; files themselves run in parallel too.
  fullyParallel: true,

  // Prevent accidentally committed .only calls from silently passing CI.
  forbidOnly: !!process.env.CI,

  // Retry twice in CI to survive transient network/CDN jitter (Prism/font loads).
  retries: process.env.CI ? 2 : 0,

  // Single worker in CI keeps resource usage predictable; local uses all cores.
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:8080',

    // Capture trace on the first retry of a failed test.
    trace: 'on-first-retry',

    // Screenshots only on failure reduce noise.
    screenshot: 'only-on-failure',
  },

  // Serve the pre-built BlazorStatic output directory.
  // Run `ASPNETCORE_ENVIRONMENT=Production dotnet run` first to populate output/.
  webServer: {
    command: 'npx serve@14 output --listen 8080 --no-clipboard',
    url: 'http://localhost:8080',
    // Reuse an already-running local server; always start fresh in CI.
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});
