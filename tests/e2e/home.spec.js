'use strict';

const { test, expect } = require('@playwright/test');

test.describe('Home Page (/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
  });

  // ── Static content ──────────────────────────────────────────────────────────

  test('displays site brand name in the navbar', async ({ page }) => {
    // Site brand lives in the navbar logo link, not in a page-level h1.
    // The h1 is the glitch/welcome heading; brand is a <div> inside #main-navbar.
    const brand = page.locator('#main-navbar').getByText("Ren's Courses");
    await expect(brand).toBeVisible();
  });

  test('glitch text element exists with correct data-text attribute', async ({ page }) => {
    const glitch = page.locator('.glitch-target');
    await expect(glitch).toBeVisible();
    const dataText = await glitch.getAttribute('data-text');
    expect(dataText).toContain('Welcome_Traveler');
  });

  test('lead paragraph is visible and non-empty', async ({ page }) => {
    // Lead paragraph has class text-text-dim; it describes the LMS purpose.
    const lead = page.locator('p.text-text-dim').first();
    await expect(lead).toBeVisible();
    const text = await lead.textContent();
    expect(text && text.trim().length).toBeGreaterThan(0);
  });

  // ── Course filter chips ─────────────────────────────────────────────────────

  test('course filter chips are rendered', async ({ page }) => {
    // Chips are injected by Blazor SSR from available course tags.
    const chips = page.locator('.course-filter-chip');
    await expect(chips.first()).toBeVisible();
    expect(await chips.count()).toBeGreaterThan(0);
  });

  test('each chip carries a data-tag attribute', async ({ page }) => {
    const firstChip = page.locator('.course-filter-chip').first();
    const tag = await firstChip.getAttribute('data-tag');
    expect(tag && tag.length).toBeGreaterThan(0);
  });

  // ── Filter interaction ──────────────────────────────────────────────────────

  test('clicking a chip activates it and reveals the clear button', async ({ page }) => {
    const chips = page.locator('.course-filter-chip');
    if (await chips.count() === 0) test.skip();

    const firstChip = chips.first();
    await firstChip.click();

    // course-filter.js adds bg-accent-dim to the active chip.
    await page.waitForFunction(
      () => document.querySelector('.course-filter-chip.bg-accent-dim') !== null
    );

    // The clear button (initially display:none) must become visible.
    const clearBtn = page.locator('#course-filter-clear');
    await expect(clearBtn).toBeVisible();
  });

  test('clicking the clear button resets all filters', async ({ page }) => {
    const chips = page.locator('.course-filter-chip');
    if (await chips.count() === 0) test.skip();

    // Activate a filter first.
    await chips.first().click();
    await page.waitForFunction(
      () => {
        const btn = document.getElementById('course-filter-clear');
        return btn && btn.style.display !== 'none';
      }
    );

    await page.locator('#course-filter-clear').click();

    // Clear button must be hidden again after clearing.
    await page.waitForFunction(
      () => {
        const btn = document.getElementById('course-filter-clear');
        return btn && btn.style.display === 'none';
      }
    );
    await expect(page.locator('#course-filter-clear')).not.toBeVisible();
  });

  test('clicking an active chip a second time deactivates it', async ({ page }) => {
    const chips = page.locator('.course-filter-chip');
    if (await chips.count() === 0) test.skip();

    const firstChip = chips.first();

    // Activate.
    await firstChip.click();
    await page.waitForFunction(
      () => document.querySelector('.course-filter-chip.bg-accent-dim') !== null
    );

    // Deactivate.
    await firstChip.click();
    await page.waitForFunction(
      () => document.querySelector('.course-filter-chip.bg-accent-dim') === null
    );

    await expect(page.locator('#course-filter-clear')).not.toBeVisible();
  });

  test('active filter hides non-matching post cards', async ({ page }) => {
    const chips = page.locator('.course-filter-chip');
    const posts = page.locator('[data-course-tags]');

    // Skip if there is nothing to filter (e.g. site built outside term window).
    if (await chips.count() === 0 || await posts.count() === 0) test.skip();

    const firstChip = chips.first();
    const filteredTag = await firstChip.getAttribute('data-tag');
    await firstChip.click();

    await page.waitForFunction(
      () => document.querySelector('.course-filter-chip.bg-accent-dim') !== null
    );

    // Every visible post must include the active tag.
    const allPosts = await posts.all();
    for (const post of allPosts) {
      const tags = await post.getAttribute('data-course-tags');
      const tagList = (tags || '').toLowerCase().split(' ');
      const isVisible = await post.isVisible();

      if (isVisible) {
        expect(tagList).toContain(filteredTag.toLowerCase());
      }
    }
  });
});
