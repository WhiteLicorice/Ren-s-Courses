'use strict';

const { test, expect } = require('@playwright/test');

test.describe('Theme Toggle', () => {
  // Force light system preference so the initial resolved theme is always
  // 'light' in a clean localStorage state, giving us a deterministic baseline.
  test.use({ colorScheme: 'light' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    // theme.js is loaded as a <script> in App.razor before DOMContentLoaded.
    await page.waitForFunction(() => typeof window.switchPrismTheme === 'function');
  });

  // ── Initial state ───────────────────────────────────────────────────────────

  test('html element has a data-theme attribute after page load', async ({ page }) => {
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(['light', 'dark']).toContain(theme);
  });

  test('data-theme is "light" when system preference is light and no localStorage override', async ({ page }) => {
    // Boot script in App.razor resolves mode from system preference when
    // no user-theme key exists in localStorage.
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('light');
  });

  test('#prism-theme-link href reflects the initial theme', async ({ page }) => {
    const prismLink = page.locator('#prism-theme-link');
    const href = await prismLink.getAttribute('href');
    // In light mode the boot script switches to prism-light.css.
    expect(href).toContain('prism-light.css');
  });

  // ── Toggle interaction ──────────────────────────────────────────────────────

  test('clicking .theme-toggle-btn switches data-theme to "dark"', async ({ page }) => {
    // Initial theme is 'light' (see colorScheme override above).
    await page.locator('.theme-toggle-btn').first().click();

    await page.waitForFunction(
      () => document.documentElement.getAttribute('data-theme') === 'dark'
    );
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('clicking the toggle updates localStorage user-theme', async ({ page }) => {
    await page.locator('.theme-toggle-btn').first().click();

    await page.waitForFunction(
      () => document.documentElement.getAttribute('data-theme') !== 'light'
    );

    // switchPrismTheme calls localStorage.setItem('user-theme', theme).
    const stored = await page.evaluate(() => localStorage.getItem('user-theme'));
    expect(['light', 'dark']).toContain(stored);
    // Must differ from the initial 'light' state.
    expect(stored).toBe('dark');
  });

  test('clicking the toggle swaps the Prism CSS href', async ({ page }) => {
    const prismLink = page.locator('#prism-theme-link');
    const initialHref = await prismLink.getAttribute('href');

    await page.locator('.theme-toggle-btn').first().click();

    // Wait for the href attribute to change.
    await page.waitForFunction(
      (initial) => {
        const link = document.getElementById('prism-theme-link');
        // getAttribute returns the serialised value; .href returns the resolved URL —
        // use getAttribute for consistency with what we recorded as initialHref.
        return link && link.getAttribute('href') !== initial;
      },
      initialHref
    );

    const newHref = await prismLink.getAttribute('href');
    expect(newHref).not.toBe(initialHref);
    // href contains the Prism theme filename regardless of whether it is
    // relative or resolved to an absolute URL by the browser.
    expect(newHref).toMatch(/prism-(dark|light)\.css/);
  });

  test('toggling twice returns to the original theme', async ({ page }) => {
    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme');

    const toggleBtn = page.locator('.theme-toggle-btn').first();

    await toggleBtn.click();
    await page.waitForFunction(
      (initial) => document.documentElement.getAttribute('data-theme') !== initial,
      initialTheme
    );

    await toggleBtn.click();
    await page.waitForFunction(
      (initial) => document.documentElement.getAttribute('data-theme') === initial,
      initialTheme
    );

    await expect(html).toHaveAttribute('data-theme', initialTheme);
  });

  // ── Icon visibility ─────────────────────────────────────────────────────────

  test('in light mode the moon icon is visible on the desktop toggle', async ({ page }) => {
    // initThemeToggle in NavMenu.razor hides sun and shows moon in light mode.
    const desktopToggle = page.locator('#main-navbar .theme-toggle-btn');
    const moonIcon = desktopToggle.locator('.icon-moon');
    await expect(moonIcon).not.toHaveClass(/\bhidden\b/);
  });

  test('after switching to dark mode the sun icon becomes visible', async ({ page }) => {
    await page.locator('.theme-toggle-btn').first().click();

    await page.waitForFunction(
      () => document.documentElement.getAttribute('data-theme') === 'dark'
    );

    const desktopToggle = page.locator('#main-navbar .theme-toggle-btn');
    const sunIcon = desktopToggle.locator('.icon-sun');
    await expect(sunIcon).not.toHaveClass(/\bhidden\b/);
  });

  // ── Persistence ─────────────────────────────────────────────────────────────

  test('persisted user-theme is restored on next page load', async ({ page }) => {
    // Switch to dark and record the preference.
    await page.locator('.theme-toggle-btn').first().click();
    await page.waitForFunction(
      () => document.documentElement.getAttribute('data-theme') === 'dark'
    );

    // Reload the page — the boot script reads localStorage before anything renders.
    await page.reload();
    await page.waitForLoadState('load');

    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('dark');
  });
});
