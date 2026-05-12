'use strict';

const { test, expect } = require('@playwright/test');

test.describe('Edge Cases', () => {
  // ── /null route ─────────────────────────────────────────────────────────────

  test('/null does not produce uncaught JavaScript errors', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    // Null.razor calls NavigateTo("") during SSR which may produce a redirect
    // or render the home page content at /null in the static output.
    await page.goto('/null', { waitUntil: 'load' });

    // The page should land somewhere without JS exceptions.
    expect(jsErrors).toHaveLength(0);

    // URL must be either / (redirected) or /null (static page rendered there).
    const finalUrl = page.url();
    expect(finalUrl).toMatch(/\/(null\/?)?$/);
  });

  // ── Non-existent article ─────────────────────────────────────────────────────

  test('navigating to a non-existent article slug does not crash', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    // The static file server returns a 404 page for unknown paths.
    // This verifies the site's 404 experience does not itself throw errors.
    await page.goto('/articles/this-slug-does-not-exist', {
      waitUntil: 'load',
    });

    expect(jsErrors).toHaveLength(0);
  });

  // ── Bookings page ─────────────────────────────────────────────────────────────

  test('/bookings loads without JavaScript errors', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto('/bookings', { waitUntil: 'load' });

    expect(jsErrors).toHaveLength(0);

    // Page must render some content — not a blank document.
    await expect(page.locator('body')).not.toBeEmpty();
  });

  // ── All key routes ────────────────────────────────────────────────────────────

  test.describe('All major routes load without JavaScript errors', () => {
    const routes = [
      '/',
      '/materials',
      '/projects',
      '/faqs',
      '/bookings',
      '/calendar',
    ];

    for (const route of routes) {
      test(`${route} renders without uncaught errors`, async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', (err) => jsErrors.push(err.message));

        await page.goto(route, { waitUntil: 'load' });

        expect(jsErrors).toHaveLength(0);
        await expect(page.locator('body')).not.toBeEmpty();
      });
    }
  });

  // ── Cross-page navigation via navbar ─────────────────────────────────────────

  test('navigating from home to /materials via navbar works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Open the dropdown that contains the Materials link (it is item #4 in
    // menu.json, i.e. index 3 which is beyond the first Take(3) in the nav).
    await page.locator('#desktop-dropdown-btn').click();
    await expect(page.locator('#desktop-dropdown-menu')).toBeVisible();

    const materialsLink = page.locator('#desktop-dropdown-menu a', {
      hasText: 'Materials',
    });
    await materialsLink.click();

    await page.waitForURL(/\/materials/);
    expect(page.url()).toContain('/materials');
  });

  test('navigating from /materials back to / via the logo link works', async ({ page }) => {
    await page.goto('/materials');
    await page.waitForLoadState('load');

    // The site logo/title in NavMenu.razor is a link to the root ('').
    const logoLink = page.locator('#main-navbar a[href=""]').first();
    await logoLink.click();

    await page.waitForURL(/\/$/);
    expect(page.url()).toMatch(/\/$/);
  });
});
