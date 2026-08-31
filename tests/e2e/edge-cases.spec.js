'use strict';

const { test, expect } = require('@playwright/test');

const OFFLINE_CACHE_PREFIX = 'ren-courses-online-first-v3';
const ALLOWED_OFFLINE_ORIGINS = [
  'https://cdnjs.cloudflare.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://keepandroidopen.org',
];

async function waitForControlledServiceWorker(page) {
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false;

    const registration = await navigator.serviceWorker.ready;
    return registration.active?.state === 'activated' && navigator.serviceWorker.controller;
  });
}

async function readOfflineArticleState(page) {
  return page.evaluate(() => {
    const prismThemeLink = document.querySelector('#prism-theme-link');
    let prismThemeRules = 0;

    try {
      prismThemeRules = prismThemeLink?.sheet?.cssRules?.length ?? 0;
    } catch {
      prismThemeRules = 0;
    }

    return {
      pathname: window.location.pathname,
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      hasArticle: Boolean(document.querySelector('article')),
      codeBlockCount: document.querySelectorAll('article pre code').length,
      hasPrism: typeof window.Prism === 'object',
      hasPowershellGrammar: Boolean(window.Prism?.languages?.powershell),
      prismThemeRules,
    };
  });
}

test.describe('Edge Cases', () => {
  // ── /null route ─────────────────────────────────────────────────────────────

  test('/null does not produce uncaught JavaScript errors', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    // Null.razor calls NavigateTo("") during SSR which may produce a redirect
    // or render the home page content at /null in the static output.
    await page.goto('/null', { waitUntil: 'load' });

    // The page should land somewhere without JS exceptions.
    expect(jsErrors).toHaveLength(0);

    // URL must be either / (redirected) or /null (static page rendered there).
    const finalUrl = page.url();
    expect(finalUrl).toMatch(/\/(null\/?)?$/);
  });

  // ── Non-existent article ─────────────────────────────────────────────────────

  test('navigating to a non-existent article slug does not crash', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    // The static file server returns a 404 page for unknown paths.
    // This verifies the site's 404 experience does not itself throw errors.
    await page.goto('/articles/this-slug-does-not-exist', {
      waitUntil: 'load',
    });

    expect(jsErrors).toHaveLength(0);
  });

  // ── Bookings page ─────────────────────────────────────────────────────────────

  test('/bookings loads without JavaScript errors', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto('/bookings', { waitUntil: 'load' });

    expect(jsErrors).toHaveLength(0);

    // Page must render some content — not a blank document.
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('pages expose one valid web manifest', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });

    const manifestHrefs = await page.locator('link[rel="manifest"]').evaluateAll(links =>
      links.map(link => new URL(link.href).pathname));

    expect(manifestHrefs).toEqual(['/site.webmanifest']);
  });

  test('service worker is published at the application root', async ({ request }) => {
    const rootWorker = await request.get('/service-worker.js');
    expect(rootWorker.ok()).toBe(true);

    const legacyWorker = await request.get('/js/service-worker.js');
    expect(legacyWorker.status()).toBe(404);
  });

  test('registers the service worker from the document base URI', async ({ page }) => {
    await page.addInitScript(() => {
      window.__registeredServiceWorkerUrls = [];
      if (!('serviceWorker' in navigator)) return;

      const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
      navigator.serviceWorker.register = (scriptURL, options) => {
        window.__registeredServiceWorkerUrls.push({
          url: new URL(scriptURL, document.baseURI).href,
          options,
        });
        return originalRegister(scriptURL, options);
      };
    });

    await page.goto('/', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__registeredServiceWorkerUrls?.length === 1);

    const registration = await page.evaluate(() => window.__registeredServiceWorkerUrls[0]);
    expect(new URL(registration.url).pathname).toBe('/service-worker.js');
  });

  test('offline manifest lists clean generated routes', async ({ request }) => {
    const response = await request.get('/offline-manifest.json');
    expect(response.ok()).toBe(true);

    const manifest = await response.json();
    expect(manifest.routes).toEqual(expect.arrayContaining([
      './',
      'articles/cmsc-124-lab0',
      'calendar',
      'projects',
      'bookings',
      'faqs',
      'materials',
    ]));
    expect(manifest.routes.every(route => !route.endsWith('.html'))).toBe(true);
  });

  test('pre-caches every generated clean route', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForControlledServiceWorker(page);

    const cachedRoutes = await page.evaluate(async ({ cacheName, routes }) => {
      const cache = await caches.open(cacheName);
      const missingRoutes = [];

      for (const route of routes) {
        const url = new URL(route === './' ? '/' : `/${route}`, window.location.href);
        if (!(await cache.match(new Request(url.href)))) {
          missingRoutes.push(url.pathname);
        }
      }

      return missingRoutes;
    }, { cacheName: OFFLINE_CACHE_PREFIX, routes: await page.evaluate(async () =>
      (await (await fetch('/offline-manifest.json')).json()).routes) });

    expect(cachedRoutes).toEqual([]);
  });

  for (const { route, marker } of [
    { route: '/articles/cmsc-124-lab0', marker: 'Onboarding' },
    { route: '/calendar', marker: 'Calendar' },
    { route: '/projects', marker: 'Showcase' },
    { route: '/bookings', marker: 'Bookings' },
    { route: '/faqs', marker: 'FAQs' },
    { route: '/materials', marker: 'Materials' },
  ]) {
    test(`online navigation replaces a stale cached response for ${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'load' });
      await waitForControlledServiceWorker(page);

      const staleMarker = `STALE CACHE MARKER ${route}`;
      await page.evaluate(async ({ cacheName, marker }) => {
        const cache = await caches.open(cacheName);
        await cache.put(
          new Request(window.location.href),
          new Response(`<html><body>${marker}</body></html>`, {
            headers: { 'Content-Type': 'text/html' },
          })
        );
      }, { cacheName: OFFLINE_CACHE_PREFIX, marker: staleMarker });

      await page.reload({ waitUntil: 'load' });

      const cachedPage = await page.evaluate(async cacheName => {
        const response = await caches.match(window.location.href, { cacheName });
        return response ? response.text() : null;
      }, OFFLINE_CACHE_PREFIX);

      expect(cachedPage).toContain(marker);
      expect(cachedPage).not.toContain(staleMarker);
    });
  }

  for (const theme of ['dark', 'light']) {
    test(`reloads a cached article offline in ${theme} theme`, async ({ page }) => {
      const offlineFailures = [];
      const pageErrors = [];
      let offline = false;

      page.on('pageerror', error => pageErrors.push(error.message));
      page.on('requestfailed', request => {
        if (offline) {
          offlineFailures.push({
            url: request.url(),
            failure: request.failure()?.errorText,
          });
        }
      });

      await page.addInitScript(selectedTheme => {
        localStorage.setItem('user-theme', selectedTheme);
      }, theme);

      await page.goto('/articles/cmsc-124-lab0', { waitUntil: 'load' });
      await waitForControlledServiceWorker(page);
      await page.reload({ waitUntil: 'load' });

      const cacheState = await page.evaluate(async cachePrefix => {
        const cacheName = (await caches.keys()).find(name => name === cachePrefix);
        if (!cacheName) return null;

        const keys = await (await caches.open(cacheName)).keys();
        return keys.map(request => new URL(request.url).pathname);
      }, OFFLINE_CACHE_PREFIX);

      expect(cacheState).not.toBeNull();
      expect(cacheState).toContain('/articles/cmsc-124-lab0');

      offline = true;
      await page.context().setOffline(true);
      await page.reload({ waitUntil: 'load' });

      const state = await readOfflineArticleState(page);
      expect(state.pathname).toBe('/articles/cmsc-124-lab0');
      expect(state.hasArticle).toBe(true);
      expect(state.codeBlockCount).toBeGreaterThan(0);
      expect(state.hasPrism).toBe(true);
      expect(state.hasPowershellGrammar).toBe(true);
      expect(state.prismThemeRules).toBeGreaterThan(0);
      expect(state.backgroundColor).toBe(
        theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(13, 17, 23)'
      );
      expect(pageErrors).toEqual([]);

      const relevantFailures = offlineFailures.filter(({ url }) => {
        const origin = new URL(url).origin;
        return origin === new URL(page.url()).origin || ALLOWED_OFFLINE_ORIGINS.includes(origin);
      }).filter(({ failure }) => failure !== 'NS_BINDING_ABORTED');
      expect(relevantFailures).toEqual([]);
    });
  }

  // ── All key routes ────────────────────────────────────────────────────────────

  test.describe('All major routes load without JavaScript errors', () => {
    const routes = [
      '/',
      '/materials',
      '/projects',
      '/faqs',
      '/bookings',
      '/calendar',
    ];

    for (const route of routes) {
      test(`${route} renders without uncaught errors`, async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', (err) => jsErrors.push(err.message));

        await page.goto(route, { waitUntil: 'load' });

        expect(jsErrors).toHaveLength(0);
        await expect(page.locator('body')).not.toBeEmpty();
      });
    }
  });

  // ── Cross-page navigation via navbar ─────────────────────────────────────────

  test('navigating from home to /materials via navbar works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Open the dropdown that contains the Materials link (it is item #4 in
    // menu.json, i.e. index 3 which is beyond the first Take(3) in the nav).
    await page.locator('#desktop-dropdown-btn').click();
    await expect(page.locator('#desktop-dropdown-menu')).toBeVisible();

    const materialsLink = page.locator('#desktop-dropdown-menu a', {
      hasText: 'Materials',
    });
    await materialsLink.click();

    await page.waitForURL(/\/materials/);
    expect(page.url()).toContain('/materials');
  });

  test('navigating from /materials back to / via the logo link works', async ({ page }) => {
    await page.goto('/materials');
    await page.waitForLoadState('load');

    // The site logo/title in NavMenu.razor is a link to the root ('').
    const logoLink = page.locator('#main-navbar a[href=""]').first();
    await logoLink.click();

    await page.waitForURL(/\/$/);
    expect(page.url()).toMatch(/\/$/);
  });
});
