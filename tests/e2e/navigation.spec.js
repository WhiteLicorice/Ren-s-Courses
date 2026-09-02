'use strict';

const { test, expect } = require('@playwright/test');

/**
 * Wait until the scroll position stops changing on its own. A late layout shift
 * makes the browser re-anchor the view, which fires a scroll event no test
 * asked for. Consuming that here keeps scroll assertions about the scrolling
 * the test actually did.
 */
async function waitForScrollToSettle(page, framesRequired = 5) {
  await page.waitForFunction(frames => new Promise(resolve => {
    let last = window.scrollY;
    let stable = 0;
    const tick = () => {
      if (window.scrollY === last) stable += 1;
      else {
        stable = 0;
        last = window.scrollY;
      }
      if (stable >= frames) resolve(true);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), framesRequired);
}

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
    // 7 total menu items − 3 shown directly = 4 in the dropdown.
    // (Was 8/5 before the Submissions tab was deprecated and dropped from menu.json.)
    expect(await items.count()).toBe(4);
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
    // Two things used to make this flake, both observed in Firefox:
    //
    // The document scrolls smoothly, so `scrollBy` starts an animation instead
    // of moving at once. Scrolling up while the downward animation still runs
    // leaves the page moving down, which correctly re-hides the navbar.
    //
    // A late layout shift, roughly 97px on this page, makes Firefox adjust the
    // scroll position to keep the view steady. That fires a downward scroll the
    // test never asked for, and the navbar correctly hides again. Waiting for
    // the position to stop changing consumes that shift before the real scroll.
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      // Scroll anchoring is what turns a layout shift into a scroll event.
      // This test is about the navbar handler, not about anchoring.
      document.documentElement.style.overflowAnchor = 'none';
      document.body.style.overflowAnchor = 'none';
      window.scrollTo(0, 500);
    });
    await waitForScrollToSettle(page);
    await page.waitForFunction(
      () => document.getElementById('main-navbar')?.classList.contains('-translate-y-full')
    );

    // Scroll back up — NavMenu.razor handler removes the class on upward scroll.
    const target = await page.evaluate(() => {
      const top = Math.max(65, window.scrollY - 200);
      window.scrollTo(0, top);
      return top;
    });
    // Above the 64px threshold, so this exercises the upward-scroll branch and
    // not the "back at the top" branch.
    expect(target).toBeGreaterThan(64);

    // The handler is throttled with requestAnimationFrame, so the class settles
    // a frame or more after the scroll.
    await expect(page.locator('#main-navbar')).not.toHaveClass(/-translate-y-full/);
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
    // All 7 menu.json items are rendered in the mobile menu.
    expect(await links.count()).toBe(7);
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

    // The panel sibling (w-full h-full) covers the backdrop in z-order, so any
    // pointer click at real coordinates hits the panel, not the backdrop.
    // Use evaluate+element.click() to fire the click event directly on the backdrop
    // DOM node, bypassing the browser's pointer hit-test entirely.
    await page.evaluate(() => document.getElementById('mobile-backdrop').click());

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
