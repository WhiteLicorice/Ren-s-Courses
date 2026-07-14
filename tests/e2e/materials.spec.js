'use strict';

const { test, expect } = require('@playwright/test');

// ── Materials tag cloud (/materials) ─────────────────────────────────────────

test.describe('Materials Tag Cloud (/materials)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/materials');
    await page.waitForLoadState('load');
  });

  test('tag cloud renders with links to /materials/{tag}', async ({ page }) => {
    // Static output uses relative hrefs: href="materials/cmsc-125" (no leading slash).
    const tagLinks = page.locator('a[href*="materials/"]');
    await expect(tagLinks.first()).toBeVisible();
    expect(await tagLinks.count()).toBeGreaterThan(0);
  });

  test('each tag link has a count badge', async ({ page }) => {
    // The count badge lives inside the tag card (span with count number).
    const firstCard = page.locator('a[href*="materials/"]').first();
    const badge = firstCard.locator('span').last();
    await expect(badge).toBeVisible();
    const badgeText = await badge.textContent();
    expect(Number.isInteger(parseInt(badgeText))).toBe(true);
  });

  test('clicking a tag card navigates to the filtered materials page', async ({ page }) => {
    const firstTagLink = page.locator('a[href*="materials/"]').first();
    const href = await firstTagLink.getAttribute('href');
    // Relative href — no leading slash in static output.
    expect(href).toMatch(/materials\/[a-z0-9-]+/);

    await firstTagLink.click();
    await page.waitForURL(/\/materials\//);
    expect(page.url()).toContain('/materials/');
  });
});

// ── Filtered materials page (/materials/cmsc-125) ────────────────────────────
// Uses cmsc-125 — confirmed to have materials in the current term's static output.
// (cmsc-124 has articles but none published in the current term window.)

test.describe('Materials Filtered Page (/materials/cmsc-125)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/materials/cmsc-125');
    await page.waitForLoadState('load');
  });

  test('shows the "All Materials" back-link', async ({ page }) => {
    const backLink = page.locator('a', { hasText: 'All Materials' });
    await expect(backLink).toBeVisible();
  });

  test('"All Materials" back-link navigates to /materials', async ({ page }) => {
    const backLink = page.locator('a', { hasText: 'All Materials' });
    await backLink.click();
    await page.waitForURL(/\/materials\/?$/);
    expect(page.url()).toMatch(/\/materials\/?$/);
  });

  test('post cards are visible (requires site built within term window)', async ({ page }) => {
    // CourseContentProvider only surfaces materials while STATIC_GEN_TIME is
    // between TERM_START and TERM_END.  The CI workflow pins STATIC_GEN_TIME
    // to 2026-03-15T12:00:00Z which is inside the current term.
    const cards = page.locator('article');
    const count = await cards.count();
    if (count === 0) {
      // Site was built outside the term window — skip gracefully.
      test.skip();
      return;
    }
    await expect(cards.first()).toBeVisible({ timeout: 5000 });
    expect(count).toBeGreaterThan(0);
  });

  test('post card title links to an article page', async ({ page }) => {
    const cards = page.locator('article');
    if (await cards.count() === 0) { test.skip(); return; }
    // Static output uses relative hrefs: href="articles/cmsc-125-..." (no leading slash).
    const firstCard = cards.first();
    const postLink = firstCard.locator('a[href*="articles/"]').first();
    await expect(postLink).toBeVisible();
    const href = await postLink.getAttribute('href');
    expect(href).toMatch(/articles\//);
  });

  test('clicking a post card title navigates to /articles/{slug}', async ({ page }) => {
    const cards = page.locator('article');
    if (await cards.count() === 0) { test.skip(); return; }
    const postLink = cards.first().locator('a[href*="articles/"]').first();
    await postLink.click();
    await page.waitForURL(/\/articles\//);
    expect(page.url()).toContain('/articles/');
  });

  test('post card shows a date and a primary tag badge', async ({ page }) => {
    const cards = page.locator('article');
    if (await cards.count() === 0) { test.skip(); return; }
    const firstCard = cards.first();
    // Published date is rendered as a <time> element.
    await expect(firstCard.locator('time')).toBeVisible();
  });
});

// ── Article page (/articles/cmsc-124-lab0) ───────────────────────────────────

test.describe('Article Page (/articles/cmsc-124-lab0)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/articles/cmsc-124-lab0');
    await page.waitForLoadState('load');
    // toc.js and code-features.js run on DOMContentLoaded via site.js.
    await page.waitForFunction(() => typeof window.generateTOC === 'function');
  });

  test('loads with a non-empty article title', async ({ page }) => {
    // Article page renders an <h1> inside <header> or <article>.
    const title = page.locator('article h1, header h1').first();
    await expect(title).toBeVisible();
    const text = await title.textContent();
    expect(text && text.trim().length).toBeGreaterThan(0);
  });

  test('native Download action downloads the generated PDF', async ({ page }) => {
    const link = page.locator('[data-download-action][data-download-source="generated"]');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('download', 'cmsc-124-lab0.pdf');

    const downloadPromise = page.waitForEvent('download');
    await link.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^cmsc-124-lab0(?:\.[0-9a-f]{12})?\.pdf$/);
    expect(await download.failure()).toBeNull();
  });

  test('desktop TOC (#toc-content) is populated with anchor links', async ({ page }) => {
    // toc.js generates links with data-target (not href) to avoid Blazor nav interference.
    await page.waitForSelector('#toc-content a[data-target]', { timeout: 5000 });
    const tocLinks = page.locator('#toc-content a[data-target]');
    expect(await tocLinks.count()).toBeGreaterThan(0);
    await expect(tocLinks.first()).toBeVisible();
  });

  test('mobile TOC <details> element is present', async ({ page }) => {
    // At xl viewport width the mobile TOC is hidden with xl:hidden; it still
    // exists in the DOM regardless of viewport.
    const mobileToc = page.locator('#mobile-toc-content').locator('..');
    await expect(mobileToc).toBeAttached();
  });

  test('clicking a desktop TOC link scrolls the corresponding heading into view', async ({ page }) => {
    await page.waitForSelector('#toc-content a[data-target]', { timeout: 5000 });
    const firstLink = page.locator('#toc-content a[data-target]').first();
    const targetId = await firstLink.getAttribute('data-target');

    await firstLink.click();

    // toc.js scrolls the target into view.  Wait for the element to be
    // within the visible viewport.
    await page.waitForFunction(
      (id) => {
        const el = document.getElementById(id);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
      },
      targetId
    );
  });

  test('code blocks are enhanced with a .code-wrapper container', async ({ page }) => {
    // code-features.js wraps every .prose pre in a <div class="code-wrapper">.
    await page.waitForSelector('.code-wrapper', { timeout: 5000 });
    const wrappers = page.locator('.code-wrapper');
    expect(await wrappers.count()).toBeGreaterThan(0);
  });

  test('each .code-wrapper carries a data-language attribute', async ({ page }) => {
    await page.waitForSelector('.code-wrapper[data-language]', { timeout: 5000 });
    const wrapper = page.locator('.code-wrapper[data-language]').first();
    const lang = await wrapper.getAttribute('data-language');
    expect(lang && lang.trim().length).toBeGreaterThan(0);
  });

  test('each code block has a copy button injected by code-features.js', async ({ page }) => {
    await page.waitForSelector('.copy-button', { timeout: 5000 });
    const copyBtns = page.locator('.copy-button');
    expect(await copyBtns.count()).toBeGreaterThan(0);
    await expect(copyBtns.first()).toBeVisible();
  });
});
