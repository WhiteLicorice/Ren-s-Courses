'use strict';

const { test, expect, chromium, firefox } = require('@playwright/test');
const fs = require('fs');
const http = require('http');
const path = require('path');

const OFFLINE_META_CACHE = 'ren-courses-offline-meta';

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

function createOfflineUpdateFixture(route = ARTICLE_ROUTE, options = {}) {
  const outputRoot = path.resolve(__dirname, '..', '..', 'output');
  const relativeRoute = route.replace(/^\/+/, '');
  const routeFile = route.startsWith('/articles/')
    ? `${relativeRoute}.html`
    : path.join(relativeRoute, 'index.html');
  const routeTemplate = fs.readFileSync(
    path.join(outputRoot, routeFile),
    'utf8'
  );
  let version = 1;
  let networkAvailable = true;
  const redirectCleanRoute = options.redirectCleanRoute === true;

  const responseFor = (requestUrl) => {
    const { pathname } = new URL(requestUrl, 'http://127.0.0.1');
    if (redirectCleanRoute && pathname === route) {
      return {
        status: 301,
        headers: { Location: `${route}/` },
        body: '',
        contentType: 'text/html',
      };
    }
    if (pathname === route || (redirectCleanRoute && pathname === `${route}/`)) {
      return {
        body: routeTemplate.replace(
          /<body([^>]*)>/,
          `<body$1><div id="offline-fixture-version">OFFLINE FIXTURE V${version}</div>`
        ),
        contentType: 'text/html',
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
    if (!networkAvailable) {
      request.socket.destroy();
      return;
    }
    const result = responseFor(request.url);
    if (!result) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(result.status || 200, {
      'Content-Type': result.contentType,
      ...(result.headers || {}),
    });
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
    setNetworkAvailable(available) {
      networkAvailable = available;
    },
    async close() {
      server.closeAllConnections?.();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}

async function readActiveOfflineCacheName(page) {
  return page.evaluate(async metaCacheName => {
    const cache = await caches.open(metaCacheName);
    const scope = new URL('/', location.href);
    const statusUrl = new URL('__offline-status.json', scope);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const response = await cache.match(statusUrl);
      if (response) {
        const meta = await response.json();
        if (meta.activeBuildId) return `ren-courses-offline-${meta.activeBuildId}`;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  }, OFFLINE_META_CACHE);
}

function createTwoDeploymentFixture() {
  const outputRoot = path.resolve(__dirname, '..', '..', 'output');
  const baseManifest = JSON.parse(fs.readFileSync(
    path.join(outputRoot, 'offline-manifest.json'), 'utf8'));
  const baseWorker = fs.readFileSync(path.join(outputRoot, 'service-worker.js'), 'utf8');
  const articleFile = path.join(outputRoot, 'articles/cmsc-124-lab0.html');
  const articleTemplate = fs.readFileSync(articleFile, 'utf8');
  const deploymentIds = {
    A: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    B: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  };
  const deployments = Object.fromEntries(Object.entries(deploymentIds).map(([name, buildId]) => {
    const manifest = { ...baseManifest, buildId };
    const worker = baseWorker.replace(
      /const OFFLINE_BUILD_ID = '[a-f0-9]{64}';/,
      `const OFFLINE_BUILD_ID = '${buildId}';`);
    return [name, { manifest, worker }];
  }));
  let activeDeployment = 'A';
  let failRequiredAsset = false;
  let requestCounts = new Map();
  const requiredAsset = baseManifest.assets.find(asset => asset.includes('mermaid.min.js'));

  const countRequest = requestUrl => {
    const url = new URL(requestUrl, 'http://127.0.0.1');
    const key = `${url.pathname}${url.search}`;
    requestCounts.set(key, (requestCounts.get(key) || 0) + 1);
  };

  const responseFor = requestUrl => {
    const url = new URL(requestUrl, 'http://127.0.0.1');
    countRequest(requestUrl);
    const deployment = deployments[activeDeployment];

    if (url.pathname === '/service-worker.js') {
      return { body: deployment.worker, contentType: 'application/javascript' };
    }
    if (url.pathname === '/offline-manifest.json') {
      return { body: JSON.stringify(deployment.manifest), contentType: 'application/json' };
    }
    if (failRequiredAsset && activeDeployment === 'B'
      && `vendor/mermaid/mermaid.min.js${url.search}` === `${requiredAsset}`) {
      return { status: 503, body: 'fixture failure', contentType: 'text/plain' };
    }

    if (url.pathname === '/articles/cmsc-124-lab0') {
      return {
        body: articleTemplate.replace(
          /<body([^>]*)>/,
          `<body$1><div id="offline-fixture-deployment">DEPLOYMENT ${activeDeployment}</div>`),
        contentType: 'text/html',
      };
    }

    const relativePath = url.pathname.replace(/^\/+/, '') || 'index.html';
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
    response.writeHead(result.status || 200, { 'Content-Type': result.contentType });
    response.end(result.body);
  });

  return {
    manifest: baseManifest,
    requiredAsset,
    async start() {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      return `http://127.0.0.1:${server.address().port}`;
    },
    setDeployment(nextDeployment) {
      activeDeployment = nextDeployment;
      requestCounts = new Map();
    },
    setFailRequiredAsset(nextValue) {
      failRequiredAsset = nextValue;
      requestCounts = new Map();
    },
    requestCounts() {
      return Object.fromEntries(requestCounts);
    },
    async close() {
      server.closeAllConnections?.();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}

async function readCompleteOfflineInventory(page, cacheName) {
  return page.evaluate(async ({ cacheName }) => {
    const manifest = await (await fetch('/offline-manifest.json')).json();
    const scope = new URL('/', location.href);
    const localUrls = new Set([
      new URL('/offline-manifest.json', scope).href,
    ]);

    for (const route of manifest.routes) {
      const routeUrl = new URL(route === './' ? '/' : `/${route}`, scope);
      localUrls.add(routeUrl.href);
      if (!routeUrl.pathname.endsWith('/')) {
        const slashUrl = new URL(routeUrl.href);
        slashUrl.pathname += '/';
        localUrls.add(slashUrl.href);
      }
    }
    for (const asset of manifest.assets) {
      localUrls.add(new URL(asset, scope).href);
    }

    const cache = await caches.open(cacheName);
    const missingLocal = [];
    for (const url of localUrls) {
      if (!(await cache.match(new Request(url)))) missingLocal.push(url);
    }

    const unexpectedCrossOrigin = (await cache.keys())
      .map(request => new URL(request.url))
      .filter(url => url.origin !== location.origin)
      .map(url => url.href);

    return {
      manifestRoutes: manifest.routes,
      manifestAssets: manifest.assets,
      missingLocal,
      unexpectedCrossOrigin,
      generatedPdfUrls: manifest.assets.filter(asset =>
        new URL(asset, scope).pathname.endsWith('.pdf')),
    };
  }, { cacheName });
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

    const cacheName = await readActiveOfflineCacheName(page);
    expect(cacheName).toMatch(/^ren-courses-offline-[a-f0-9]{64}$/);
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
    }, { cacheName, routes: await page.evaluate(async () =>
      (await (await fetch('/offline-manifest.json')).json()).routes) });

    expect(cachedRoutes).toEqual([]);
  });

  test.describe('offline article cache', () => {
    test.describe.configure({ mode: 'serial' });

    // Each test waits for the service worker to pre-cache every generated route
    // and asset, over 150 entries in a showcase build. That finishes in about
    // 11 seconds alone, but exceeds the default 30-second budget in Firefox
    // when the rest of the suite competes for the machine.
    test.slow();

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
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.locator('article')).toBeVisible();

        const cacheName = await readActiveOfflineCacheName(page);
        const cacheState = await page.evaluate(async cacheName => {
          if (!cacheName) return null;

          const keys = await (await caches.open(cacheName)).keys();
          return keys.map(request => new URL(request.url).pathname);
        }, cacheName);

        expect(cacheState).not.toBeNull();
        expect(cacheState).toContain('/articles/cmsc-124-lab0');

        offline = true;
        await page.context().setOffline(true);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.locator('article')).toBeVisible();

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
          return origin === new URL(page.url()).origin;
        }).filter(({ failure }) => failure !== 'NS_BINDING_ABORTED');
        expect(relevantFailures).toEqual([]);
      });
    }
  });

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

test.describe('Deterministic offline cache', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120000);

  test('pre-caches every generated route and exact local asset', async ({ page }) => {
    await page.goto(ARTICLE_ROUTE, { waitUntil: 'load' });
    await waitForControlledServiceWorker(page);

    const cacheName = await readActiveOfflineCacheName(page);
    const inventory = await readCompleteOfflineInventory(page, cacheName);

    expect(inventory.manifestRoutes.length).toBeGreaterThan(0);
    expect(inventory.manifestAssets.length).toBeGreaterThan(0);
    expect(inventory.missingLocal).toEqual([]);
    expect(inventory.unexpectedCrossOrigin).toEqual([]);
    expect(inventory.generatedPdfUrls.length).toBeGreaterThan(0);

    const material = await page.evaluate(async ({ cacheName, pdfAsset }) => {
      const pdfUrl = new URL(pdfAsset, new URL('/', location.href)).href;
      const response = await (await caches.open(cacheName)).match(pdfUrl);
      return {
        pdfUrl,
        pdfBytes: response ? [...new Uint8Array(await response.arrayBuffer())].slice(0, 5) : null,
      };
    }, { cacheName, pdfAsset: inventory.generatedPdfUrls[0] });

    expect(material.pdfUrl).toMatch(/\/pdfs\/[^/]+\.pdf$/);
    expect(material.pdfBytes).toEqual([37, 80, 68, 70, 45]);

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

    const cacheName = await readActiveOfflineCacheName(page);
    const aliases = await page.evaluate(async cacheName => {
      const cache = await caches.open(cacheName);
      return [
        await cache.match(new URL('/materials', location.href)),
        await cache.match(new URL('/materials/', location.href)),
      ].map(Boolean);
    }, cacheName);
    expect(aliases).toEqual([true, true]);

    await page.context().setOffline(true);

    await page.goto('/materials', { waitUntil: 'domcontentloaded' });
    expect(new URL(page.url()).pathname).toBe('/materials');
    await expect(page.locator('body')).toContainText('Materials');

    await page.goto('/materials/', { waitUntil: 'domcontentloaded' });
    expect(new URL(page.url()).pathname).toBe('/materials');
    await expect(page.locator('body')).toContainText('Materials');
  });

  test('returns 503 for an unknown route while offline', async ({ page }) => {
    const fixture = createOfflineUpdateFixture();
    const fixtureOrigin = await fixture.start();

    try {
      await page.goto(`${fixtureOrigin}/`, { waitUntil: 'load' });
      await waitForControlledServiceWorker(page);
      fixture.setNetworkAvailable(false);

      const requestedUrl = `${fixtureOrigin}/articles/not-in-the-manifest`;
      const response = await page.goto(requestedUrl, {
        waitUntil: 'domcontentloaded',
      });
      expect(response?.status()).toBe(503);

      const body = await response?.text();
      expect(body).toMatch(/^Offline resource unavailable:/);
      expect(body).toContain(requestedUrl);
    } finally {
      await fixture.close();
    }
  });

  test('does not mutate an immutable snapshot during online navigation', async ({ page }) => {
    const fixture = createOfflineUpdateFixture();
    const fixtureOrigin = await fixture.start();

    try {
      await page.goto(`${fixtureOrigin}${ARTICLE_ROUTE}`, { waitUntil: 'load' });
      await waitForControlledServiceWorker(page);
      await expect(page.locator('#offline-fixture-version')).toHaveText('OFFLINE FIXTURE V1');

      const cacheName = await readActiveOfflineCacheName(page);
      fixture.setVersion(2);
      await page.reload({ waitUntil: 'load' });
      await expect(page.locator('#offline-fixture-version')).toHaveText('OFFLINE FIXTURE V2');

      const cachedArticle = await page.evaluate(async cacheName => {
        const response = await (await caches.open(cacheName)).match(
          new URL('/articles/cmsc-124-lab0', location.href));
        return response ? response.text() : null;
      }, cacheName);
      expect(cachedArticle).toContain('OFFLINE FIXTURE V1');
      expect(cachedArticle).not.toContain('OFFLINE FIXTURE V2');
    } finally {
      await fixture.close();
    }
  });

  test('keeps the old snapshot when deployment B fails, then installs B once repaired', async ({ page }) => {
    const fixture = createTwoDeploymentFixture();
    const fixtureOrigin = await fixture.start();

    try {
      await page.goto(`${fixtureOrigin}/`, { waitUntil: 'load' });
      await waitForControlledServiceWorker(page);
      await expect(page.locator('#offline-status-badge')).toHaveAttribute(
        'data-offline-state', 'ready');

      const cacheA = await readActiveOfflineCacheName(page);
      await page.evaluate(async () => {
        const cache = await caches.open('unrelated-cache');
        await cache.put(new URL('/unrelated', location.href), new Response('keep'));
      });

      fixture.setDeployment('B');
      fixture.setFailRequiredAsset(true);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await expect(page.locator('#offline-status-badge')).toHaveAttribute(
        'data-offline-state', 'error', { timeout: 60000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('#offline-status-badge')).toHaveAttribute(
        'data-offline-state', 'error', { timeout: 10000 });

      expect(await page.evaluate(async cacheName => caches.has(cacheName), cacheA)).toBe(true);
      await page.context().setOffline(true);
      const oldArticle = await page.evaluate(async () => (await fetch(
        '/articles/cmsc-124-lab0')).text());
      expect(oldArticle).toContain('DEPLOYMENT A');

      await page.context().setOffline(false);
      fixture.setFailRequiredAsset(false);
      await page.locator('#offline-status-badge').click();
      await expect(page.locator('#offline-status-badge')).toHaveAttribute(
        'data-offline-state', 'ready', { timeout: 60000 });

      const cacheB = await readActiveOfflineCacheName(page);
      expect(cacheB).toBe('ren-courses-offline-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
      expect(await page.evaluate(async cacheName => caches.has(cacheName), cacheA)).toBe(false);
      expect(await page.evaluate(async () => caches.has('unrelated-cache'))).toBe(true);

      const expectedRequestKeys = [
        '/offline-manifest.json',
        ...fixture.manifest.routes.map(route => route === './' ? '/' : `/${route}`),
        ...fixture.manifest.assets.map(asset => `/${asset}`),
      ];
      const requestCounts = fixture.requestCounts();
      for (const key of expectedRequestKeys) {
        expect(requestCounts[key]).toBe(1);
      }

      await page.context().setOffline(true);
      await page.goto(`${fixtureOrigin}${ARTICLE_ROUTE}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#offline-fixture-deployment')).toHaveText('DEPLOYMENT B');
    } finally {
      await fixture.close();
    }
  });
});

test.describe('Installed PWA offline startup', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180000);

  test('reports readiness, serves cached assets without retries, and cold-starts offline (installed-app proxy)', async ({ browserName }, testInfo) => {
    const fixture = createOfflineUpdateFixture();
    const fixtureOrigin = await fixture.start();
    const profileDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'renscourses-pwa-test-'));
    const browserType = browserName === 'firefox' ? firefox : chromium;
    const persistentOptions = {
      headless: true,
      ...(testInfo.project.name === 'msedge'
        ? { channel: 'msedge', args: [`--app=${fixtureOrigin}/`] }
        : {}),
    };
    let context;

    try {
      context = await browserType.launchPersistentContext(profileDir, persistentOptions);
      let page = context.pages()[0] || await context.newPage();
      await page.goto(`${fixtureOrigin}/`, { waitUntil: 'load' });
      await waitForControlledServiceWorker(page);
      await expect(page.locator('#offline-status-badge')).toHaveAttribute(
        'data-offline-state', 'ready');

      await context.setOffline(true);
      const cachedAsset = await page.evaluate(async () => {
        const started = performance.now();
        const response = await fetch('/site.webmanifest');
        return {
          status: response.status,
          elapsedMs: performance.now() - started,
        };
      });
      expect(cachedAsset.status).toBe(200);
      expect(cachedAsset.elapsedMs).toBeLessThan(500);

      await context.close();
      context = await browserType.launchPersistentContext(profileDir, {
        ...persistentOptions,
        offline: true,
      });
      page = context.pages()[0] || await context.newPage();

      for (const route of ['/', '/materials', '/calendar', ARTICLE_ROUTE]) {
        const response = await page.goto(`${fixtureOrigin}${route}`, {
          waitUntil: 'domcontentloaded',
          timeout: 10000,
        });
        expect(response?.status()).toBe(200);
        expect(new URL(page.url()).pathname).toBe(route);
      }

      await expect(page.locator('article')).toBeVisible();
      await expect(page.locator('article pre code')).not.toHaveCount(0);
    } finally {
      await context?.close();
      await fixture.close();
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
  });

  test('preserves the clean URL when a route redirects to a slash alias', async ({ page }) => {
    const fixture = createOfflineUpdateFixture('/materials', { redirectCleanRoute: true });
    const fixtureOrigin = await fixture.start();

    try {
      await page.goto(`${fixtureOrigin}/materials`, { waitUntil: 'load' });
      await waitForControlledServiceWorker(page);
      await expect(page.locator('#offline-status-badge')).toHaveAttribute(
        'data-offline-state', 'ready');

      await page.context().setOffline(true);
      await page.goto(`${fixtureOrigin}/materials`, { waitUntil: 'domcontentloaded' });
      expect(new URL(page.url()).pathname).toBe('/materials');
      await expect(page.locator('body')).toContainText('Materials');
    } finally {
      await fixture.close();
    }
  });

  test('repairs a missing local asset from the status badge', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForControlledServiceWorker(page);
    await expect(page.locator('#offline-status-badge')).toHaveAttribute(
      'data-offline-state', 'ready');

    const cacheName = await readActiveOfflineCacheName(page);
    const asset = await page.evaluate(async cacheName => {
      const manifest = await (await fetch('/offline-manifest.json')).json();
      const selected = manifest.assets.find(value => value.endsWith('.js'));
      await (await caches.open(cacheName)).delete(new URL(selected, location.href));
      return selected;
    }, cacheName);

    await page.locator('#offline-status-badge').click();
    await expect(page.locator('#offline-status-badge')).toHaveAttribute(
      'data-offline-state', 'error', { timeout: 30000 });

    await page.locator('#offline-status-badge').click();
    await expect(page.locator('#offline-status-badge')).toHaveAttribute(
      'data-offline-state', 'ready', { timeout: 60000 });
    expect(await page.evaluate(async ({ cacheName, asset }) =>
      Boolean(await (await caches.open(cacheName)).match(new URL(asset, location.href))),
    { cacheName, asset })).toBe(true);
  });
});
