'use strict';

const { test, expect } = require('@playwright/test');
const {
  NESTED_ARTICLE_SLUG, NESTED_ARTICLE_ROUTE, NESTED_MEDIA_ASSET
} = require('../fixtures/site/routes');

// The fixture material lives at
// Materials/fixture-course-a/fixture-lab-nested/fixture-course-a-lab-nested.md
// with its image in a media folder beside it.

test.describe('Nested material', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(NESTED_ARTICLE_ROUTE);
    await page.waitForLoadState('load');
  });

  test('keeps the flat article URL', async ({ page }) => {
    expect(new URL(page.url()).pathname).toBe(NESTED_ARTICLE_ROUTE);
    const title = page.locator('article h1, header h1').first();
    await expect(title).toHaveText('Fixture Nested Laboratory');
  });

  test('shows the image from the media folder beside the file', async ({ page }) => {
    const image = page.locator('.prose img[alt="Fixture figure"]');
    await expect(image).toBeVisible();
    await expect.poll(
      () => image.evaluate(element => element.complete && element.naturalWidth > 0)
    ).toBe(true);

    const src = await image.getAttribute('src');
    expect(src).toContain('Content/Materials/fixture-course-a/fixture-lab-nested/media/');
    // A rooted Windows path is what the absolute fixture ContentPath produced.
    expect(src).not.toMatch(/^[A-Za-z]:[\\/]/);
  });

  test('the page links a generated PDF that exists under that name', async ({ page, request }) => {
    const link = page.locator('[data-download-action][data-download-source="generated"]');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('download', `${NESTED_ARTICLE_SLUG}.pdf`);

    const href = await link.getAttribute('href');
    expect(href).toMatch(new RegExp(`^pdfs/${NESTED_ARTICLE_SLUG}\\.[0-9a-f]{12}\\.pdf$`));

    const baseUrl = await page.evaluate(() => document.baseURI);
    const response = await request.get(new URL(href, baseUrl).href);
    expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('the offline manifest lists the image', async ({ request }) => {
    const manifest = await (await request.get('/offline-manifest.json')).json();
    expect(manifest.assets).toContain(NESTED_MEDIA_ASSET);
  });
});
