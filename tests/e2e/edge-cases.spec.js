'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const http = require('http');
const path = require('path');

const OFFLINE_CACHE_PREFIX = 'ren-courses-online-first-v4';
const COMPLETE_OFFLINE_CACHE = 'ren-courses-online-first-v4';
const ALLOWED_OFFLINE_ORIGINS = [
  'https://cdnjs.cloudflare.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://keepandroidopen.org',
];

const ARTICLE_ROUTE = '/articles/cmsc-124-lab0';

const MIME_TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

function createOfflineUpdateFixture(route = ARTICLE_ROUTE) {
  const outputRoot = path.resolve(__dirname, '..', '..', 'output');
  const relativeRoute = route.replace(/^\/+/, '');
  const routeFile = route.startsWith('/articles/')
    ? `${relativeRoute}.html`
    : path.join(relativeRoute, 'index.html');
  let routeTemplate = fs.readFileSync(
    path.join(outputRoot, routeFile),
    'utf8'
  );
  const servesPdf = route === ARTICLE_ROUTE;
  if (servesPdf) routeTemplate = routeTemplate.replace(
    /href="pdfs\/[^"]+\.pdf"/,
    'href="pdfs/offline-update.pdf"'
  );
  let version = 1;

  const responseFor = (requestUrl) => {
    const { pathname } = new URL(requestUrl, 'http://127.0.0.1');
    if (pathname === route) {
      return {
        body: routeTemplate.replace(
          /<body([^>]*)>/,
          `<body$1><div id="offline-fixture-version">OFFLINE FIXTURE V${version}</div>`
        ),
        contentType: 'text/html',
      };
    }
    if (servesPdf && pathname === '/pdfs/offline-update.pdf') {
      return {
        body: `%PDF-1.4\nOFFLINE FIXTURE PDF V${version}\n%%EOF\n`,
        contentType: 'application/pdf',
      };
    }

    const relativePath = pathname.replace(/^\/+/, '') || 'index.html';
    let filePath = path.join(outputRoot, relativePath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    } else if (!path.extname(filePath) && fs.existsSync(`${filePath}.html`)) {
      filePath = `${filePath}.html`;
    }

    if (!filePath.startsWith(`${outputRoot}${path.sep}`) || !fs.existsSync(filePath)) {
      return null;
    }

    return {
      body: fs.readFileSync(filePath),
      contentType: MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    };
  };

  const server = http.createServer((request, response) => {
    const result = responseFor(request.url);
    if (!result) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { 'Content-Type': result.contentType });
    response.end(result.body);
  });

  return {
    async start() {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      return `http://127.0.0.1:${address.port}`;
    },
    setVersion(nextVersion) {
      version = nextVersion;
    },
    async close() {
      server.closeAllConnections?.();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}

async function readCompleteOfflineInventory(page, cacheName, articleRoute = ARTICLE_ROUTE) {
  return page.evaluate(async ({ cacheName, articleRoute, allowedOrigins }) => {
    const manifest = await (await fetch('/offline-manifest.json')).json();
    const localUrls = new Set([
      new URL('/offline-manifest.json', location.href).href,
    ]);
    const generatedPdfUrls = new Set();
    let articleDocument = null;

    for (const route of manifest.routes) {
      const routeUrl = new URL(route === './' ? '/' : `/${route}`, location.href);
      localUrls.add(routeUrl.href);
      const response = await fetch(routeUrl);
      const html = await response.text();
      const document = new DOMParser().parseFromString(html, 'text/html');
      if (routeUrl.pathname === articleRoute) articleDocument = document;
      const baseHref = document.querySelector('base')?.getAttribute('href');
      const resourceBase = baseHref ? new URL(baseHref, routeUrl) : routeUrl;
      document.querySelectorAll('[src], link[href], a[data-download-source="generated"]').forEach(element => {
        const rawUrl = element.getAttribute('src') || element.getAttribute('href');
        if (!rawUrl) return;
        const url = new URL(rawUrl, resourceBase);
        if (url.origin !== location.origin) return;
        if (element.matches('a') && !url.pathname.endsWith('.pdf')) return;
        localUrls.add(url.href);
        if (element.matches('a')) generatedPdfUrls.add(url.href);
      });
    }

    const cache = await caches.open(cacheName);
    const missingLocal = [];
    for (const url of localUrls) {
      const request = new Request(url);
      if (!(await cache.match(request, { ignoreSearch: true }))) missingLocal.push(new URL(url).pathname);
    }

    const externalKeys = (await cache.keys())
      .map(request => request.url)
      .filter(url => allowedOrigins.includes(new URL(url).origin));
    const externalDocument = articleDocument || new DOMParser().parseFromString('', 'text/html');
    const googleStylesheet = [...externalDocument.querySelectorAll('link[href]')]
      .map(link => new URL(link.href).href)
      .find(url => url.startsWith('https://fonts.googleapis.com/'));
    const nestedFontUrls = [];
    if (googleStylesheet) {
      const cssResponse = await cache.match(googleStylesheet);
      if (cssResponse) {
        const css = await cssResponse.text();
        for (const match of css.matchAll(/url\((?:"([^"]+)"|'([^']+)'|([^)]*))\)/gi)) {
          const rawUrl = match[1] || match[2] || match[3].trim();
          const url = new URL(rawUrl, googleStylesheet);
          if (url.origin === 'https://fonts.gstatic.com') nestedFontUrls.push(url.href);
        }
      }
    }

    const missingExternal = [...new Set([
      ...[...externalDocument.querySelectorAll('script[src], link[href]')]
        .map(element => element.src || element.href)
        .filter(url => allowedOrigins.includes(new URL(url).origin)),
      ...nestedFontUrls,
    ])].filter(url => !externalKeys.includes(url));

    const unexpectedCrossOrigin = (await cache.keys())
      .map(request => new URL(request.url))
      .filter(url => url.origin !== location.origin && !allowedOrigins.includes(url.origin))
      .map(url => url.href);

    return {
      manifestRoutes: manifest.routes,
      missingLocal,
      missingExternal,
      unexpectedCrossOrigin,
      generatedPdfUrls: [...generatedPdfUrls],
      articleRoute,
    };
    }, { cacheName, articleRoute, allowedOrigins: ALLOWED_OFFLINE_ORIGINS });
}

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

test.describe('Complete v4 offline cache', () => {
  test.setTimeout(120000);

  test('completes CDN caching when the first page loads during installation', async ({ page }) => {
    const pageExternalRequests = [];
    page.on('request', request => {
      const origin = new URL(request.url()).origin;
      if (ALLOWED_OFFLINE_ORIGINS.includes(origin)) pageExternalRequests.push(request.url());
    });

    await page.goto(ARTICLE_ROUTE, { waitUntil: 'domcontentloaded' });
    await waitForControlledServiceWorker(page);

    const inventory = await readCompleteOfflineInventory(page, COMPLETE_OFFLINE_CACHE);
    expect(pageExternalRequests.length).toBeGreaterThan(0);
    expect(inventory.missingExternal).toEqual([]);
    expect(inventory.missingLocal).toEqual([]);
  });

  test('pre-caches every generated route, material PDF, media, and CDN dependency', async ({ page }) => {
    await page.goto(ARTICLE_ROUTE, { waitUntil: 'load' });
    await waitForControlledServiceWorker(page);

    const inventory = await readCompleteOfflineInventory(page, COMPLETE_OFFLINE_CACHE);

    expect(inventory.manifestRoutes.length).toBeGreaterThan(0);
    expect(inventory.missingLocal).toEqual([]);
    expect(inventory.missingExternal).toEqual([]);
    expect(inventory.unexpectedCrossOrigin).toEqual([]);
    expect(inventory.generatedPdfUrls.length).toBeGreaterThan(0);

    const material = await page.evaluate(async ({ cacheName }) => {
      const pdfUrl = document.querySelector('a[data-download-source="generated"]')?.href;
      if (!pdfUrl) return { pdfUrl: null, pdfBytes: null };

      const cache = await caches.open(cacheName);
      const response = await cache.match(pdfUrl);
      return {
        pdfUrl,
        pdfBytes: response ? [...new Uint8Array(await response.arrayBuffer())].slice(0, 8) : null,
      };
    }, { cacheName: COMPLETE_OFFLINE_CACHE });

    expect(material.pdfUrl).toMatch(/\/pdfs\/[^/]+\.pdf$/);
    expect(material.pdfBytes?.slice(0, 5)).toEqual([37, 80, 68, 70, 45]);

    await page.context().setOffline(true);
    const offlinePdf = await page.evaluate(async url => {
      const response = await fetch(url);
      return {
        status: response.status,
        bytes: [...new Uint8Array(await response.arrayBuffer())].slice(0, 5),
      };
    }, material.pdfUrl);
    expect(offlinePdf).toEqual({
      status: 200,
      bytes: [37, 80, 68, 70, 45],
    });
  });

  test('serves clean and trailing-slash route aliases offline', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForControlledServiceWorker(page);

    const aliases = await page.evaluate(async cacheName => {
      const cache = await caches.open(cacheName);
      return [
        await cache.match(new URL('/materials', location.href)),
        await cache.match(new URL('/materials/', location.href)),
      ].map(Boolean);
    }, COMPLETE_OFFLINE_CACHE);
    expect(aliases).toEqual([true, true]);

    await page.context().setOffline(true);

    await page.goto('/materials', { waitUntil: 'load' });
    expect(new URL(page.url()).pathname).toBe('/materials');
    await expect(page.locator('body')).toContainText('Materials');

    await page.goto('/materials/', { waitUntil: 'load' });
    expect(new URL(page.url()).pathname).toBe('/materials/');
    await expect(page.locator('body')).toContainText('Materials');
  });

  test('retries the current route and replaces article HTML and PDF after reconnect', async ({ page }) => {
    const fixture = createOfflineUpdateFixture();
    const fixtureOrigin = await fixture.start();

    try {
      await page.goto(`${fixtureOrigin}${ARTICLE_ROUTE}`, { waitUntil: 'load' });
      await waitForControlledServiceWorker(page);

      const absolutePdfUrl = await page.locator('a[data-download-source="generated"]').evaluate(anchor => anchor.href);
      if (!absolutePdfUrl) throw new Error('The fixture article has no generated PDF link.');

      await expect(page.locator('#offline-fixture-version')).toHaveText('OFFLINE FIXTURE V1');
      const initialPdf = await page.evaluate(async url => {
        const response = await fetch(url);
        return {
          status: response.status,
          url: response.url,
          type: response.type,
          text: await response.text(),
        };
      }, absolutePdfUrl);
      expect(initialPdf.status).toBe(200);
      expect(initialPdf.text).toContain('OFFLINE FIXTURE PDF V1');

      await page.context().setOffline(true);
      fixture.setVersion(2);
      await page.context().setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));

      const refreshResult = await page.evaluate(() => new Promise(resolve => {
        const channel = new MessageChannel();
        const timeout = setTimeout(() => resolve({ ok: false, error: 'refresh timeout' }), 30000);
        channel.port1.onmessage = event => {
          clearTimeout(timeout);
          resolve(event.data);
        };
        navigator.serviceWorker.controller.postMessage({
          type: 'refresh-route',
          url: window.location.href,
        }, [channel.port2]);
      }));
      expect(refreshResult.ok).toBe(true);

      await expect.poll(
        async () => page.evaluate(async ({ cacheName, pdf }) => {
          const cache = await caches.open(cacheName);
          const article = await cache.match(location.href);
          const pdfResponse = await cache.match(pdf);
          return {
            article: article ? (await article.text()).includes('OFFLINE FIXTURE V2') : false,
            pdf: pdfResponse ? (await pdfResponse.text()).includes('OFFLINE FIXTURE PDF V2') : false,
          };
        }, { cacheName: COMPLETE_OFFLINE_CACHE, pdf: absolutePdfUrl })
      ).toEqual({
        article: true,
        pdf: true,
      });

      await page.reload({ waitUntil: 'load' });
      await expect(page.locator('#offline-fixture-version')).toHaveText('OFFLINE FIXTURE V2');

      await page.context().setOffline(true);
      const offlinePdf = await page.evaluate(async url => {
        const response = await fetch(url);
        return await response.text();
      }, absolutePdfUrl);
      expect(offlinePdf).toContain('OFFLINE FIXTURE PDF V2');
    } finally {
      await fixture.close();
    }
  });

  for (const route of ['/calendar', '/projects', '/bookings', '/faqs', '/materials']) {
    test(`refreshes an updated ${route} after reconnect`, async ({ page }) => {
      const fixture = createOfflineUpdateFixture(route);
      const fixtureOrigin = await fixture.start();

      try {
        await page.goto(`${fixtureOrigin}${route}`, { waitUntil: 'load' });
        await waitForControlledServiceWorker(page);
        await expect(page.locator('#offline-fixture-version')).toHaveText('OFFLINE FIXTURE V1');

        await page.context().setOffline(true);
        fixture.setVersion(2);
        await page.context().setOffline(false);
        await page.evaluate(() => window.dispatchEvent(new Event('online')));

        const refreshResult = await page.evaluate(() => new Promise(resolve => {
          const channel = new MessageChannel();
          const timeout = setTimeout(() => resolve({ ok: false, error: 'refresh timeout' }), 30000);
          channel.port1.onmessage = event => {
            clearTimeout(timeout);
            resolve(event.data);
          };
          navigator.serviceWorker.controller.postMessage({
            type: 'refresh-route',
            url: window.location.href,
          }, [channel.port2]);
        }));
        expect(refreshResult.ok).toBe(true);

        await expect.poll(
          async () => page.evaluate(async () => {
            const response = await caches.match(location.href, {
              cacheName: 'ren-courses-online-first-v4',
            });
            return response ? (await response.text()).includes('OFFLINE FIXTURE V2') : false;
          })
        ).toBe(true);

        await page.reload({ waitUntil: 'load' });
        await expect(page.locator('#offline-fixture-version')).toHaveText('OFFLINE FIXTURE V2');

        await page.context().setOffline(true);
        await page.reload({ waitUntil: 'load' });
        await expect(page.locator('#offline-fixture-version')).toHaveText('OFFLINE FIXTURE V2');
      } finally {
        await fixture.close();
      }
    });
  }
});
