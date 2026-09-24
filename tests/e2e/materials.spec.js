'use strict';

const { test, expect } = require('@playwright/test');
const {
  COURSE, ARTICLE_SLUG, ARTICLE_ROUTE, EXTERNAL_ARTICLE_ROUTE, EXTERNAL_DOWNLOAD_LINK
} = require('../fixtures/site/routes');

// ── Materials tag cloud (/materials) ─────────────────────────────────────────

test.describe('Materials Tag Cloud (/materials)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/materials');
    await page.waitForLoadState('load');
  });

  test('tag cloud renders with links to /materials/{tag}', async ({ page }) => {
    // Static output uses relative hrefs: href="materials/fixture-course-a" (no leading slash).
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

// ── Filtered materials page (/materials/fixture-course-a) ────────────────────

test.describe('Materials Filtered Page (/materials/fixture-course-a)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/materials/${COURSE}`);
    await page.waitForLoadState('load');
  });

  // Exact name: the empty-state panel adds a second "View all materials" link when
  // the course is outside ACTIVE_COURSES, which a substring match resolves to as well.
  const backLinkOf = page => page.getByRole('link', { name: 'All Materials', exact: true });

  test('shows the "All Materials" back-link', async ({ page }) => {
    const backLink = backLinkOf(page);
    await expect(backLink).toBeVisible();
  });

  test('"All Materials" back-link navigates to /materials', async ({ page }) => {
    const backLink = backLinkOf(page);
    await backLink.click();
    await page.waitForURL(/\/materials\/?$/);
    expect(page.url()).toMatch(/\/materials\/?$/);
  });

  test('post cards are visible', async ({ page }) => {
    // The fixture build freezes STATIC_GEN_TIME inside the term window, so the
    // course's material is always visible.
    const cards = page.locator('article');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('post card title links to an article page', async ({ page }) => {
    const cards = page.locator('article');
    // Static output uses relative hrefs: href="articles/fixture-course-a-lab1" (no leading slash).
    const firstCard = cards.first();
    const postLink = firstCard.locator('a[href*="articles/"]').first();
    await expect(postLink).toBeVisible();
    const href = await postLink.getAttribute('href');
    expect(href).toMatch(/articles\//);
  });

  test('clicking a post card title navigates to /articles/{slug}', async ({ page }) => {
    const cards = page.locator('article');
    const postLink = cards.first().locator('a[href*="articles/"]').first();
    await postLink.click();
    await page.waitForURL(/\/articles\//);
    expect(page.url()).toContain('/articles/');
  });

  test('post card shows a date and a primary tag badge', async ({ page }) => {
    const cards = page.locator('article');
    const firstCard = cards.first();
    // Published date is rendered as a <time> element.
    await expect(firstCard.locator('time')).toBeVisible();
  });
});

// ── Article page (/articles/fixture-course-a-lab1) ───────────────────────────

test.describe('Article Page (/articles/fixture-course-a-lab1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ARTICLE_ROUTE);
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
    await expect(link).toHaveAttribute('download', `${ARTICLE_SLUG}.pdf`);

    const downloadPromise = page.waitForEvent('download');
    await link.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(new RegExp(`^${ARTICLE_SLUG}(?:\\.[0-9a-f]{12})?\\.pdf$`));
    expect(await download.failure()).toBeNull();
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

  test('unlabelled code blocks keep readable colors in light mode', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('user-theme', 'light'));
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await page.waitForSelector('.code-wrapper', { timeout: 5000 });

    const code = page.locator('.code-wrapper pre').filter({ hasText: 'repo-root' });
    await expect(code).toBeVisible();

    const colors = await code.evaluate(element => {
      const codeElement = element.querySelector('code');
      return {
        pre: getComputedStyle(element).color,
        code: getComputedStyle(codeElement).color,
      };
    });

    expect(colors).toEqual({
      pre: 'rgb(31, 35, 40)',
      code: 'rgb(31, 35, 40)',
    });
  });

  test('dragging a code scrollbar applies the accent state', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('user-theme', 'light'));
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await page.waitForSelector('.code-wrapper', { timeout: 5000 });

    const code = page.locator('.code-wrapper pre').filter({ hasText: 'repo-root' });
    await code.scrollIntoViewIfNeeded();
    await expect.poll(() => code.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);

    const box = await code.boundingBox();
    if (!box) throw new Error('The code block has no layout box.');

    try {
      await page.mouse.move(box.x + 40, box.y + box.height - 3);
      await page.mouse.down();
      await expect(code).toHaveClass(/\bscrollbar-dragging\b/);
      if (test.info().project.name === 'firefox') {
        await expect.poll(() => code.evaluate(element => getComputedStyle(element).scrollbarColor))
          .toBe('rgb(207, 34, 46) rgba(0, 0, 0, 0)');
      }
    } finally {
      await page.mouse.up();
    }

    await expect(code).not.toHaveClass(/\bscrollbar-dragging\b/);
  });
});

// ── Article with an external download (/articles/fixture-course-b-lab1) ──────

test('a declared downloadLink replaces the generated PDF', async ({ page }) => {
  // The build exempts this material from PDF generation. The page must link the
  // declared URL and carry no generated action.
  await page.goto(EXTERNAL_ARTICLE_ROUTE);
  const link = page.locator('[data-download-action]');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute('data-download-source', 'external');
  await expect(link).toHaveAttribute('href', EXTERNAL_DOWNLOAD_LINK);
  await expect(link).toHaveAttribute('target', '_blank');
});
