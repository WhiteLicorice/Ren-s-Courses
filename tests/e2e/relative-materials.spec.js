'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { NESTED_ARTICLE_SLUG } = require('../fixtures/site/routes');

// Serves the relative-profile fixture build under both the root and the
// GitHub Pages prefix. The prefixed HTML gets the same base rewrite the CI
// applies to App.razor. The image and PDF URLs stay relative, so each base
// resolves them under its own prefix.

const root = path.resolve(__dirname, '..', '..', 'output-e2e-relative');
const PREFIX = '/Ren-s-Courses';

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

let server;
let origin;

function resolveFile(pathname) {
  const candidates = pathname.endsWith('/')
    ? [path.join(root, pathname, 'index.html')]
    : [
        path.join(root, pathname),
        path.join(root, `${pathname}.html`),
        path.join(root, pathname, 'index.html'),
      ];

  return candidates.find(candidate => {
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return false;
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
}

test.beforeAll(async () => {
  server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    const prefixed = pathname === PREFIX || pathname.startsWith(`${PREFIX}/`);
    if (prefixed) pathname = pathname.slice(PREFIX.length) || '/';

    const file = resolveFile(pathname);
    if (!file) {
      response.writeHead(404);
      response.end('not found');
      return;
    }

    let body = fs.readFileSync(file);
    const extension = path.extname(file).toLowerCase();
    if (extension === '.html' && prefixed) {
      body = Buffer.from(body.toString('utf8')
        .replace('<base href="/">', `<base href="${PREFIX}/">`));
    }

    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[extension] || 'application/octet-stream',
      'Content-Length': body.length,
    });
    response.end(body);
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  console.log(`[relative-materials] static server: ${origin}`);
});

test.afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

for (const base of ['', PREFIX]) {
  test.describe(`relative production content under ${base || '/'}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${origin}${base}/articles/${NESTED_ARTICLE_SLUG}`);
      await page.waitForLoadState('load');
    });

    test('keeps the exact article URL and loads the image', async ({ page }) => {
      expect(new URL(page.url()).pathname)
        .toBe(`${base}/articles/${NESTED_ARTICLE_SLUG}`);

      const image = page.locator('.prose img[alt="Fixture figure"]');
      await expect(image).toBeVisible();
      await expect.poll(
        () => image.evaluate(element => element.complete && element.naturalWidth > 0)
      ).toBe(true);

      const src = await image.getAttribute('src');
      expect(src).toContain(
        'Content/Materials/fixture-course-a/fixture-lab-nested/media/');
      expect(src).not.toMatch(/^[A-Za-z]:[\\/]|^\//);
    });

    test('links a PDF that resolves under the base', async ({ page, request }) => {
      const link = page.locator('[data-download-action][data-download-source="generated"]');
      await expect(link).toBeVisible();

      const href = await link.getAttribute('href');
      const baseUrl = await page.evaluate(() => document.baseURI);
      const absolute = new URL(href, baseUrl).href;

      expect(new URL(absolute).pathname).toMatch(
        new RegExp(`^${base}/pdfs/${NESTED_ARTICLE_SLUG}\\.[0-9a-f]{12}\\.pdf$`));

      const response = await request.get(absolute);
      expect(response.ok()).toBe(true);
      expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
    });

    test('the worker becomes ready', async ({ page }) => {
      await page.waitForFunction(async () => {
        const registration = await navigator.serviceWorker.ready;
        if (!registration.active) return false;
        const keys = await caches.keys();
        return keys.some(key => key.startsWith('ren-courses-offline-'));
      }, null, { timeout: 30000 });
    });
  });
}
