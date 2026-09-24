// @ts-check
'use strict';

const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for E2E tests against the pre-built fixture site.
 *
 * Prerequisites before running tests:
 *   npm run build:e2e-site   (generates ./output-e2e/ from tests/fixtures/site)
 *
 * The suite never reads ./output/. That folder holds the real site, built from
 * live content, and no test may depend on a live material.
 *
 * Local run:
 *   npm run test:e2e
 *
 * CI run (Chromium + Firefox):
 *   npx playwright test --project=chromium --project=firefox
 * Windows Edge run:
 *   npx playwright test tests/e2e/edge-cases.spec.js --project=msedge --workers=1
 */
module.exports = defineConfig({
  testDir: './tests/e2e',

  // Run tests within each file in parallel; files themselves run in parallel too.
  fullyParallel: true,

  // The diagram playback tests watch real 10-second holds, so one worker stays
  // busy for minutes while the rest of the suite runs beside it. Under that
  // load a timing-sensitive test can exceed the 30-second default without
  // anything being wrong. 60 seconds absorbs it and still catches a real hang.
  timeout: 60 * 1000,

  // Prevent accidentally committed .only calls from silently passing CI.
  forbidOnly: !!process.env.CI,

  // Retry twice in CI to survive transient browser or local asset jitter.
  retries: process.env.CI ? 2 : 0,

  // One worker in CI keeps resource usage predictable.
  //
  // Locally the default is half the cores. Every test context installs the
  // service worker, and each one pre-caches more than 150 routes and assets
  // from the single `npx serve` process. Eight contexts doing that at once
  // starved the server and timed out one random Firefox test per run, a
  // different test each time. Measured on the full suite: 8 workers and 4
  // workers each failed one test, 2 workers passed all 288.
  workers: process.env.CI ? 1 : 2,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    // Not 8080: a leftover `serve output` there holds the live site, and
    // reuseExistingServer would run the suite against it without a warning.
    baseURL: 'http://localhost:8081',

    // Capture trace on the first retry of a failed test.
    trace: 'on-first-retry',

    // Screenshots only on failure reduce noise.
    screenshot: 'only-on-failure',
  },

  // Serve the pre-built fixture site. Run `npm run build:e2e-site` first.
  webServer: {
    command: 'npx serve@14 output-e2e --listen 8081 --no-clipboard',
    url: 'http://localhost:8081',
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
    ...(process.platform === 'win32' ? [{
      name: 'msedge',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'msedge',
      },
    }] : []),
  ],
});
