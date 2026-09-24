// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { ARTICLE_ROUTE } = require('../fixtures/site/routes');

/**
 * No e2e test may depend on a live material. The suite reads the fixture site
 * that `npm run build:e2e-site` writes to output-e2e/. These guards fail when
 * the server under test holds anything else: the real site in output/, a stale
 * fixture build, or a fixture site that leaked a live page or PDF.
 */
test('the server under test is the fixture site', async ({ request }) => {
  const response = await request.get('/offline-manifest.json');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();

  expect(manifest.routes).toContain(ARTICLE_ROUTE.slice(1));
  const articles = manifest.routes.filter(route => route.startsWith('articles/'));
  expect(articles.length).toBeGreaterThan(0);
  expect(articles.every(route => route.startsWith('articles/fixture-'))).toBe(true);
});

test('the fixture site publishes no live material PDF', async ({ request }) => {
  const manifest = await (await request.get('/offline-manifest.json')).json();
  const pdfs = manifest.assets.filter(asset => /\.pdf(?:[?#]|$)/.test(asset));
  expect(pdfs.length).toBeGreaterThan(0);
  expect(pdfs.every(asset => asset.startsWith('pdfs/fixture-'))).toBe(true);
});

test('course pages list only fixture courses', async ({ page }) => {
  await page.goto('/materials');
  const tags = await page.locator('a[href*="materials/"]').evaluateAll(links =>
    links.map(link => link.getAttribute('href').split('materials/')[1]));
  expect(tags.length).toBeGreaterThan(0);
  expect(tags.every(tag => tag.startsWith('fixture-'))).toBe(true);
});
