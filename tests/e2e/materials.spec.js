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

  test('clicking a TOC link keeps the article path in the URL', async ({ page }) => {
    // history.replaceState resolves relative URLs against document.baseURI, and
    // App.razor sets <base href="/">, so a bare '#id' rewrites the URL to the site root.
    await page.waitForSelector('#toc-content a[data-target]', { timeout: 5000 });
    const link = page.locator('#toc-content a[data-target]').nth(2);
    const targetId = await link.getAttribute('data-target');

    await link.click();

    await expect(page).toHaveURL(`/articles/cmsc-124-lab0#${targetId}`);
  });

  test('clicking a TOC link moves the highlight to that entry', async ({ page }) => {
    await page.waitForSelector('#toc-content a[data-target]', { timeout: 5000 });
    const link = page.locator('#toc-content a[data-target]').nth(2);
    const targetId = await link.getAttribute('data-target');

    await link.click();

    const active = page.locator('#toc-content a.text-accent');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute('data-target', targetId);
    await expect(active).toHaveAttribute('aria-current', 'true');
  });

  test('clicking the last TOC link once keeps its highlight at the document bottom', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload();
    await page.waitForLoadState('load');
    await page.waitForFunction(() => typeof window.generateTOC === 'function');
    await page.waitForSelector('#toc-content a[data-target]', { timeout: 5000 });
    const link = page.locator('#toc-content a[data-target]').last();
    const targetId = await link.getAttribute('data-target');

    await link.click();
    // Allow the smooth scroll and the following scroll-spy frame to settle.
    await page.waitForTimeout(1200);

    const active = page.locator('#toc-content a.text-accent');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute('data-target', targetId);
  });

  test('the anchored heading clears the fixed navbar', async ({ page }) => {
    await page.waitForSelector('#toc-content a[data-target]', { timeout: 5000 });
    const link = page.locator('#toc-content a[data-target]').nth(2);
    const targetId = await link.getAttribute('data-target');

    await link.click();
    // Let the smooth scroll settle before measuring.
    await page.waitForFunction((id) => {
      const el = document.getElementById(id);
      return el && Math.abs(el.getBoundingClientRect().top) < 400;
    }, targetId);
    await page.waitForTimeout(600);

    const navHeight = await page.evaluate(
      () => document.getElementById('main-navbar').getBoundingClientRect().height);
    const headingTop = await page.evaluate(
      (id) => document.getElementById(id).getBoundingClientRect().top, targetId);

    expect(headingTop).toBeGreaterThanOrEqual(navHeight);
  });

  test('loading a URL with a hash scrolls to and highlights that section', async ({ page }) => {
    await page.goto('/articles/cmsc-124-lab0#kotlin');
    await page.waitForFunction(() => typeof window.generateTOC === 'function');
    await page.waitForFunction(() => {
      const el = document.getElementById('kotlin');
      return el && Math.abs(el.getBoundingClientRect().top) < 400;
    });
    await page.waitForTimeout(600);

    const active = page.locator('#toc-content a.text-accent');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute('data-target', 'kotlin');
  });

  test('scroll spy tracks consecutive headings without skipping any', async ({ page }) => {
    // The old IntersectionObserver band left dead zones, so headings that crossed it
    // between samples were never highlighted.
    await page.waitForSelector('#toc-content a[data-target]', { timeout: 5000 });
    const ids = await page.locator('#toc-content a[data-target]')
      .evaluateAll(links => links.slice(1, 5).map(a => a.dataset.target));

    const seen = [];
    for (const id of ids) {
      await page.evaluate((headingId) => {
        const el = document.getElementById(headingId);
        window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 40, behavior: 'instant' });
      }, id);
      await page.waitForTimeout(200);
      seen.push(await page.locator('#toc-content a.text-accent').first().getAttribute('data-target'));
    }

    expect(seen).toEqual(ids);
  });

  test('no in-body link resolves to the site root with a fragment', async ({ page }) => {
    // Markdown [text](#heading) renders as href="#heading", which <base href="/">
    // would resolve to the site root; toc.js rewrites those to a path-absolute href.
    const strays = await page.locator('.prose a').evaluateAll(links =>
      links.map(a => a.href)
        .filter(href => {
          const url = new URL(href);
          return url.origin === window.location.origin && url.pathname === '/' && url.hash !== '';
        }));
    expect(strays).toEqual([]);
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
