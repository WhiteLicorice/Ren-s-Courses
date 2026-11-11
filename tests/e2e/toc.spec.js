// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { OUTLINE_IDS, DIAGRAM_AFTER, buildTocHarnessPage } = require('../fixtures/toc-fixtures');

/**
 * These tests run the real toc.js and the real stylesheet against a permanent
 * in-memory article, not against production material. The harness is served on
 * the static server's own origin at a synthetic route. That route is not the
 * site root, so a URL that <base href="/"> strips back to the root is visible.
 * site.js never runs, so no service worker or unrelated widget can affect a
 * measurement.
 */
const HARNESS_ROUTE = '/__toc-harness';

/** Navbar clearance used by the scroll spy. Mirrors TOC_NAV_OFFSET in toc.js. */
const NAV_OFFSET = 80;

async function mount(page, {
  hash = '',
  width = 1440,
  height = 900,
  body = buildTocHarnessPage(),
  ready = { selector: '#toc-content a[data-target]', state: 'visible' }
} = {}) {
  await page.setViewportSize({ width, height });
  await page.route(`**${HARNESS_ROUTE}`, route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body
  }));
  await page.goto(HARNESS_ROUTE + hash);
  await page.waitForSelector(ready.selector, { timeout: 5000, state: ready.state });
}

const tocLink = (page, id) => page.locator(`#toc-content a[data-target="${id}"]`);
const activeIds = page => page.locator('#toc-content a.text-accent')
  .evaluateAll(links => links.map(link => link.dataset.target));

/**
 * The entry the spy must show, taken from the fixture's authored outline rather
 * than from toc.js's own heading selector. Null at the document bottom, where
 * toc.js activates the last entry by rule.
 */
const expectedActive = page => page.evaluate(({ ids, offset }) => {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll > 0 && window.scrollY >= maxScroll - 2) return null;
  let active = ids[0];
  for (const id of ids) {
    if (document.getElementById(id).getBoundingClientRect().top - offset <= 1) active = id;
  }
  return active;
}, { ids: OUTLINE_IDS, offset: NAV_OFFSET });

const waitForHeadingAtLine = (page, id) => page.waitForFunction(({ headingId, offset }) => {
  const heading = document.getElementById(headingId);
  return heading && Math.abs(heading.getBoundingClientRect().top - offset) < 4;
}, { headingId: id, offset: NAV_OFFSET });

/**
 * A heading long enough to exercise the list's long-title handling. The shared
 * fixture carries no such heading, so each test that needs one builds its own
 * harness body from the same fixture.
 */
const LONG_HEADING_ID = 'long-heading';
const LONG_HEADING_TEXT = 'A very long section heading that must wrap on a phone';

function harnessWithLongHeading() {
  return buildTocHarnessPage().replace(
    '<div class="prose max-w-none py-10">',
    `<div class="prose max-w-none py-10"><h2 id="${LONG_HEADING_ID}">${LONG_HEADING_TEXT}</h2>`
  );
}

test.describe('Table of contents (ephemeral article)', () => {
  test.beforeEach(async ({ page }) => { await mount(page); });

  test('lists exactly the authored outline, without diagram headings', async ({ page }) => {
    // Guard the fixture: the case needs hidden diagram step headings in .prose.
    expect(await page.locator('.prose [data-interactive-diagram] [data-diagram-step][hidden] h3').count())
      .toBeGreaterThan(0);
    const targets = await page.locator('#toc-content a[data-target]')
      .evaluateAll(links => links.map(link => link.dataset.target));
    expect(targets).toEqual(OUTLINE_IDS);
  });

  test('mobile TOC <details> element is present', async ({ page }) => {
    // At xl viewport width the mobile TOC is hidden with xl:hidden; it still
    // exists in the DOM regardless of viewport.
    await expect(page.locator('#mobile-toc-content').locator('..')).toBeAttached();
  });

  test('clicking a TOC link scrolls the corresponding heading into view', async ({ page }) => {
    await tocLink(page, 'part-2').click();
    await page.waitForFunction(id => {
      const rect = document.getElementById(id).getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    }, 'part-2');
  });

  test('clicking a TOC link keeps the article path in the URL', async ({ page }) => {
    // history.replaceState resolves relative URLs against document.baseURI, and
    // App.razor sets <base href="/">, so a bare '#id' rewrites the URL to the site root.
    await tocLink(page, 'build.sh-run').click();
    await expect(page).toHaveURL(`${HARNESS_ROUTE}#build.sh-run`);
  });

  test('clicking a TOC link moves the highlight to that entry', async ({ page }) => {
    await tocLink(page, 'part-2').click();
    const active = page.locator('#toc-content a.text-accent');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute('data-target', 'part-2');
    await expect(active).toHaveAttribute('aria-current', 'true');
  });

  test('clicking the last TOC link keeps its highlight at the document bottom', async ({ page }) => {
    const lastId = OUTLINE_IDS[OUTLINE_IDS.length - 1];
    await tocLink(page, lastId).click();
    await page.waitForFunction(() =>
      window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 2);
    await page.waitForTimeout(300);

    // Guard the fixture: the last heading must stay below the line, or the
    // at-bottom rule in toc.js is not what keeps the highlight.
    const lastTop = await page.evaluate(id => document.getElementById(id).getBoundingClientRect().top, lastId);
    expect(lastTop - NAV_OFFSET).toBeGreaterThan(1);
    expect(await activeIds(page)).toEqual([lastId]);
  });

  test('the anchored heading clears the fixed navbar', async ({ page }) => {
    await tocLink(page, 'part-2').click();
    await waitForHeadingAtLine(page, 'part-2');

    const navHeight = await page.evaluate(
      () => document.getElementById('main-navbar').getBoundingClientRect().height);
    const headingTop = await page.evaluate(
      id => document.getElementById(id).getBoundingClientRect().top, 'part-2');
    expect(headingTop).toBeGreaterThanOrEqual(navHeight);
  });

  test('scroll spy tracks consecutive headings without skipping any', async ({ page }) => {
    // The old IntersectionObserver band left dead zones, so headings that crossed it
    // between samples were never highlighted.
    const ids = OUTLINE_IDS.slice(1, 5);
    const seen = [];
    for (const id of ids) {
      await page.evaluate(({ headingId, offset }) => {
        const top = document.getElementById(headingId).getBoundingClientRect().top;
        window.scrollTo({ top: window.scrollY + top - offset + 40, behavior: 'instant' });
      }, { headingId: id, offset: NAV_OFFSET });
      await page.waitForTimeout(200);
      seen.push((await activeIds(page))[0]);
    }
    expect(seen).toEqual(ids);
  });

  test('the scroll spy follows authored headings after a TOC click', async ({ page }) => {
    // The reported path: a click, then the wheel over the article column. Hidden
    // diagram step headings once pinned the highlight for every sample above them.
    await tocLink(page, 'part-3').click();
    await waitForHeadingAtLine(page, 'part-3');

    const article = await page.locator('article').boundingBox();
    if (!article) throw new Error('The article has no layout box.');
    await page.mouse.move(article.x + article.width / 2, 500);

    let last = null;
    for (let step = 0; step < 10; step++) {
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(250);
      const expected = await expectedActive(page);
      if (expected === null) continue;
      expect(await activeIds(page)).toEqual([expected]);
      last = expected;
    }
    // Guard the path: the samples must reach past the diagram widget.
    expect(OUTLINE_IDS.indexOf(last)).toBeGreaterThan(OUTLINE_IDS.indexOf(DIAGRAM_AFTER));
  });

  test('the active TOC entry stays visible in the sidebar', async ({ page }) => {
    const box = page.locator('#toc-content').locator('..');
    // Guard the fixture: the case needs a sidebar box that can scroll.
    expect(await box.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);

    const targetId = OUTLINE_IDS[40];
    await page.evaluate(({ headingId, offset }) => {
      const top = document.getElementById(headingId).getBoundingClientRect().top;
      window.scrollTo({ top: window.scrollY + top - offset, behavior: 'instant' });
    }, { headingId: targetId, offset: NAV_OFFSET });
    await page.waitForTimeout(200);

    expect(await activeIds(page)).toEqual([targetId]);
    const bounds = await page.evaluate(() => {
      const active = document.querySelector('#toc-content a.text-accent').getBoundingClientRect();
      const scroller = document.querySelector('#toc-content').parentElement.getBoundingClientRect();
      return { activeTop: active.top, activeBottom: active.bottom, boxTop: scroller.top, boxBottom: scroller.bottom };
    });
    expect(bounds.activeTop).toBeGreaterThanOrEqual(bounds.boxTop);
    expect(bounds.activeBottom).toBeLessThanOrEqual(bounds.boxBottom);
  });

  test('no in-body link resolves to the site root with a fragment', async ({ page }) => {
    // Markdown [text](#heading) renders as href="#heading", which <base href="/">
    // would resolve to the site root; toc.js rewrites those to a path-absolute href.
    await expect(page.locator('#inbody-hash')).toHaveAttribute('href', `${HARNESS_ROUTE}#kotlin`);
    const strays = await page.locator('.prose a').evaluateAll(links =>
      links.map(a => a.href)
        .filter(href => {
          const url = new URL(href);
          return url.origin === window.location.origin && url.pathname === '/' && url.hash !== '';
        }));
    expect(strays).toEqual([]);
  });
});

test('loading a URL with a hash scrolls to and highlights that section', async ({ page }) => {
  await mount(page, { hash: '#kotlin' });
  await waitForHeadingAtLine(page, 'kotlin');
  await page.waitForTimeout(300);
  expect(await activeIds(page)).toEqual(['kotlin']);
});

test('no TOC test requests a production article route', async ({ page }) => {
  const requested = [];
  page.on('request', request => requested.push(request.url()));

  await mount(page);

  expect(requested.filter(url => url.includes('/articles/'))).toEqual([]);
  // toc.js still comes from the real static output.
  expect(requested.some(url => url.endsWith('js/toc.js'))).toBe(true);
});

test.describe('Table of contents on a phone', () => {
  const mobileReady = { selector: '#mobile-toc-content a[data-target]', state: 'attached' };

  test('shows the full heading and a 44px tap target at 375px', async ({ page }) => {
    await mount(page, { width: 375, height: 740, body: harnessWithLongHeading(), ready: mobileReady });
    // Open the collapsed list the way a reader does.
    await page.locator('details > summary').click();

    const link = page.locator(`#mobile-toc-content a[data-target="${LONG_HEADING_ID}"]`);
    await expect(link).toBeVisible();

    // Compare with the heading itself rather than with a literal.
    const headingText = await page.evaluate(
      id => document.getElementById(id).textContent.trim(), LONG_HEADING_ID);
    expect((await link.textContent()).trim()).toBe(headingText);
    await expect(link).toHaveAccessibleName(headingText);

    // A phone has no hover, so no entry may hide its tail behind an ellipsis.
    const truncated = await page.locator('#mobile-toc-content a[data-target]').evaluateAll(links =>
      links.map(entry => entry.innerText.trim()).filter(text => text.endsWith('...')));
    expect(truncated).toEqual([]);

    const measured = await link.evaluate(element => ({
      height: element.getBoundingClientRect().height,
      fontSize: parseFloat(getComputedStyle(element).fontSize)
    }));
    expect(measured.fontSize).toBeGreaterThanOrEqual(14);
    expect(measured.height).toBeGreaterThanOrEqual(44);
  });

  test('the desktop sidebar keeps its truncation and density at 1440px', async ({ page }) => {
    await mount(page, { width: 1440, height: 900, body: harnessWithLongHeading() });

    const link = page.locator(`#toc-content a[data-target="${LONG_HEADING_ID}"]`);
    await expect(link).toBeVisible();
    expect((await link.textContent()).trim()).toBe(`${LONG_HEADING_TEXT.slice(0, 35)}...`);

    const height = await link.evaluate(element => element.getBoundingClientRect().height);
    expect(height).toBeLessThanOrEqual(24);
  });
});
