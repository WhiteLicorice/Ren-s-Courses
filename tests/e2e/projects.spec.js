'use strict';

const { test, expect } = require('@playwright/test');

// ── Projects tag cloud (/projects) ───────────────────────────────────────────

test.describe('Projects Tag Cloud (/projects)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('load');
  });

  test('tag cloud renders with links to /projects/{tag}', async ({ page }) => {
    // Reuses CatalogsList component — same structure as /materials tag cloud.
    // Static output uses relative hrefs: href="projects/cmsc-131" (no leading slash).
    const tagLinks = page.locator('a[href*="projects/"]');
    await expect(tagLinks.first()).toBeVisible();
    expect(await tagLinks.count()).toBeGreaterThan(0);
  });

  test('each tag link href matches /projects/{tag} pattern', async ({ page }) => {
    const firstLink = page.locator('a[href*="projects/"]').first();
    const href = await firstLink.getAttribute('href');
    // Relative href — no leading slash in static output.
    expect(href).toMatch(/projects\/[a-z0-9-]+/);
  });

  test('clicking a tag link navigates to the filtered showcase page', async ({ page }) => {
    const firstLink = page.locator('a[href*="projects/"]').first();
    await firstLink.click();
    await page.waitForURL(/\/projects\//);
    expect(page.url()).toContain('/projects/');
  });
});

// ── Filtered showcase page (/projects/cmsc-131) ──────────────────────────────

test.describe('Projects Filtered Page (/projects/cmsc-131)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects/cmsc-131');
    await page.waitForLoadState('load');
  });

  test('project cards are rendered as <details> elements', async ({ page }) => {
    const cards = page.locator('details');
    await expect(cards.first()).toBeAttached();
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('project cards are collapsed by default', async ({ page }) => {
    const firstCard = page.locator('details').first();
    const isOpen = await firstCard.evaluate((el) => el.open);
    expect(isOpen).toBe(false);
  });

  test('project card title (h3) is visible in the collapsed state', async ({ page }) => {
    const firstCard = page.locator('details').first();
    const title = firstCard.locator('h3');
    await expect(title).toBeVisible();
    const text = await title.textContent();
    expect(text && text.trim().length).toBeGreaterThan(0);
  });

  test('clicking the summary expands the project card', async ({ page }) => {
    const firstCard = page.locator('details').first();
    const summary = firstCard.locator('summary');

    await summary.click();

    await page.waitForFunction(() => {
      const card = document.querySelector('details');
      return card && card.open === true;
    });

    const isOpen = await firstCard.evaluate((el) => el.open);
    expect(isOpen).toBe(true);
  });

  test('expanded card reveals abstract paragraph', async ({ page }) => {
    const firstCard = page.locator('details').first();
    await firstCard.locator('summary').click();

    await page.waitForFunction(
      () => document.querySelector('details')?.open === true
    );

    // Abstract is a <p class="text-sm …"> inside the expanded content area.
    const abstract = firstCard.locator('p.text-sm').first();
    await expect(abstract).toBeVisible();
    const text = await abstract.textContent();
    expect(text && text.trim().length).toBeGreaterThan(0);
  });

  test('clicking the summary again collapses the card', async ({ page }) => {
    const firstCard = page.locator('details').first();
    const summary = firstCard.locator('summary');

    // Expand.
    await summary.click();
    await page.waitForFunction(
      () => document.querySelector('details')?.open === true
    );

    // Collapse.
    await summary.click();
    await page.waitForFunction(
      () => document.querySelector('details')?.open === false
    );

    const isOpen = await firstCard.evaluate((el) => el.open);
    expect(isOpen).toBe(false);
  });

  test('expanded card footer shows at least one external link', async ({ page }) => {
    const firstCard = page.locator('details').first();
    await firstCard.locator('summary').click();
    await page.waitForFunction(
      () => document.querySelector('details')?.open === true
    );

    // Docs or repository links open in a new tab.
    const externalLinks = firstCard.locator('a[target="_blank"]');
    expect(await externalLinks.count()).toBeGreaterThan(0);
  });
});
