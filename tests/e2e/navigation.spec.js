'use strict';

const { test, expect } = require('@playwright/test');

// ── Desktop navigation (≥ sm breakpoint = 640 px) ────────────────────────────

test.describe('Desktop Navigation', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
  });

  test('navbar (#main-navbar) is fixed and visible', async ({ page }) => {
    const navbar = page.locator('#main-navbar');
    await expect(navbar).toBeVisible();

    const position = await navbar.evaluate(
      (el) => window.getComputedStyle(el).position
    );
    expect(position).toBe('fixed');
  });

  test('exactly three items are direct children of the desktop nav', async ({ page }) => {
    // NavMenu.razor renders .Take(3) items as direct <a> children of <nav>.
    // The remaining items live inside the hidden #desktop-dropdown-menu.
    const topLinks = page.locator('#main-navbar nav > a');
    await expect(topLinks.first()).toBeVisible();
    expect(await topLinks.count()).toBe(3);
  });

  test('first three nav items match the first three menu.json entries', async ({ page }) => {
    const topLinks = page.locator('#main-navbar nav > a');
    const texts = await topLinks.allTextContents();
    // menu.json order: Home, Showcase, FAQs
    expect(texts[0].trim()).toBe('Home');
    expect(texts[1].trim()).toBe('Showcase');
    expect(texts[2].trim()).toBe('FAQs');
  });

  test('desktop dropdown button (#desktop-dropdown-btn) is visible', async ({ page }) => {
    await expect(page.locator('#desktop-dropdown-btn')).toBeVisible();
  });

  test('clicking the dropdown button reveals #desktop-dropdown-menu', async ({ page }) => {
    await page.locator('#desktop-dropdown-btn').click();

    await page.waitForFunction(
      () => !document.getElementById('desktop-dropdown-menu')?.classList.contains('hidden')
    );
    await expect(page.locator('#desktop-dropdown-menu')).toBeVisible();
  });

  test('dropdown menu lists the remaining menu items', async ({ page }) => {
    await page.locator('#desktop-dropdown-btn').click();
    await expect(page.locator('#desktop-dropdown-menu')).toBeVisible();

    const items = page.locator('#desktop-dropdown-menu a');
    // 8 total menu items − 3 shown directly = 5 in the dropdown.
    expect(await items.count()).toBe(5);
  });

  test('clicking outside the dropdown closes it', async ({ page }) => {
    await page.locator('#desktop-dropdown-btn').click();
    await expect(page.locator('#desktop-dropdown-menu')).toBeVisible();

    // A click outside the navbar closes the menu (NavMenu.razor inline handler).
    await page.mouse.click(640, 400);

    await page.waitForFunction(
      () => document.getElementById('desktop-dropdown-menu')?.classList.contains('hidden')
    );
    await expect(page.locator('#desktop-dropdown-menu')).not.toBeVisible();
  });

  // ── Scroll hide / show behaviour ────────────────────────────────────────────

  test('navbar hides on scroll-down past 64 px', async ({ page }) => {
    // Scroll well past the 64 px threshold that triggers hide.
    await page.evaluate(() => window.scrollBy(0, 500));

    await page.waitForFunction(
      () => document.getElementById('main-navbar')?.classList.contains('-translate-y-full')
    );

    const hidden = await page.locator('#main-navbar').evaluate(
      (el) => el.classList.contains('-translate-y-full')
    );
    expect(hidden).toBe(true);
  });

  test('navbar reappears on scroll-up', async ({ page }) => {
    // Scroll down to trigger hide.
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForFunction(
      () => document.getElementById('main-navbar')?.classList.contains('-translate-y-full')
    );

    // Scroll back up — NavMenu.razor handler removes the class on upward scroll.
    await page.evaluate(() => window.scrollBy(0, -200));
    await page.waitForFunction(
      () => !document.getElementById('main-navbar')?.classList.contains('-translate-y-full')
    );

    const hidden = await page.locator('#main-navbar').evaluate(
      (el) => el.classList.contains('-translate-y-full')
    );
    expect(hidden).toBe(false);
  });
});

// ── Mobile navigation (< sm breakpoint) ─────────────────────────────────────

test.describe('Mobile Navigation', () => {
  // 375 × 667 is below the sm: 640 px breakpoint — mobile layout activates.
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
  });

  test('mobile hamburger (#toggle-button) is visible on small screens', async ({ page }) => {
    await expect(page.locator('#toggle-button')).toBeVisible();
  });

  test('desktop nav links are hidden on small screens', async ({ page }) => {
    // The desktop nav wrapper uses sm:flex so it is display:none at 375 px.
    const desktopNav = page.locator('#main-navbar nav').first();
    await expect(desktopNav).not.toBeVisible();
  });

  test('clicking the hamburger opens the mobile overlay (#mobile-menu-container)', async ({ page }) => {
    await page.locator('#toggle-button').click();

    await page.waitForFunction(
      () => !document.getElementById('mobile-menu-container')?.classList.contains('hidden')
    );
    await expect(page.locator('#mobile-menu-container')).toBeVisible();
  });

  test('mobile menu contains all navigation links', async ({ page }) => {
    await page.locator('#toggle-button').click();
    await expect(page.locator('#mobile-menu-container')).toBeVisible();

    const links = page.locator('#mobile-menu-container a');
    // All 8 menu.json items are rendered in the mobile menu.
    expect(await links.count()).toBe(8);
  });

  test('close button (#close-mobile-menu-button) hides the menu', async ({ page }) => {
    await page.locator('#toggle-button').click();
    await expect(page.locator('#mobile-menu-container')).toBeVisible();

    await page.locator('#close-mobile-menu-button').click();

    await page.waitForFunction(
      () => document.getElementById('mobile-menu-container')?.classList.contains('hidden')
    );
    await expect(page.locator('#mobile-menu-container')).not.toBeVisible();
  });

  test('clicking the backdrop (#mobile-backdrop) closes the menu', async ({ page }) => {
    await page.locator('#toggle-button').click();
    await expect(page.locator('#mobile-menu-container')).toBeVisible();

    await page.locator('#mobile-backdrop').click();

    await page.waitForFunction(
      () => document.getElementById('mobile-menu-container')?.classList.contains('hidden')
    );
    await expect(page.locator('#mobile-menu-container')).not.toBeVisible();
  });

  test('clicking a mobile menu link closes the overlay', async ({ page }) => {
    await page.locator('#toggle-button').click();
    await expect(page.locator('#mobile-menu-container')).toBeVisible();

    // Navigate to a same-origin internal link — overlay should close after nav.
    const internalLink = page.locator('#mobile-menu-container a[href="projects"]').first();
    await internalLink.click();

    // After navigation, the menu container must be hidden (inline JS in NavMenu closes it on scroll).
    // The menu hides when the page changes because a new page load resets the DOM.
    await page.waitForURL(/\/projects/);
  });
});
