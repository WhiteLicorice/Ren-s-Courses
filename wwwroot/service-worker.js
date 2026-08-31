const CACHE_NAME = 'ren-courses-online-first-v5';
const INSTALL_CACHE_NAME = `${CACHE_NAME}-installing`;
const STATUS_PATH = '__offline-status.json';
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS = [0, 250, 750];
const CACHE_CONCURRENCY = 4;

const LOCAL_ASSETS_TO_CACHE = [
    './',
    'index.html',
    'offline-manifest.json',
    'service-worker.js',
    'css/app.css',
    'css/site.css',
    'css/prism-dark.css',
    'css/prism-light.css',
    'js/theme.js',
    'js/calendar.js',
    'js/code-features.js',
    'js/interactive-diagrams.js',
    'js/scrollbars.js',
    'js/scroll-button.js',
    'js/submission-menu.js',
    'js/toc.js',
    'js/course-filter.js',
    'js/faq.js',
    'js/site.js',
    'site.webmanifest',
    'favicon.ico',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'apple-touch-icon.png'
];

const EXTERNAL_ASSETS_TO_CACHE = [
    {
        url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
        mode: 'cors'
    },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-python.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-nasm.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-bash.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-powershell.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-kotlin.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-c.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-gdscript.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-csharp.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-markdown.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-fortran.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-lisp.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-cobol.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-smalltalk.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-cpp.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-java.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-rust.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-toml.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-yaml.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-dart.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-go.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-julia.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js', mode: 'cors' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-cmake.min.js', mode: 'cors' },
    { url: 'https://keepandroidopen.org/banner.js?id=header&hidebutton=off', mode: 'no-cors' }
];

const ALLOWED_EXTERNAL_ORIGINS = new Set([
    'https://cdnjs.cloudflare.com',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://keepandroidopen.org'
]);

const localRequestsInFlight = new Map();
const externalRequestsInFlight = new Map();

function isCacheableResponse(response) {
    return response.ok || response.type === 'opaque';
}

function withoutSearch(request) {
    const url = new URL(request.url);
    url.search = '';
    url.hash = '';
    return new Request(url.href);
}

function withoutHash(url) {
    const result = new URL(url.href || url);
    result.hash = '';
    return result;
}

function isLocalAssetRequest(request) {
    if (request.method !== 'GET') return false;

    const url = new URL(request.url);
    return url.origin === self.location.origin && request.mode !== 'navigate';
}

function isAllowedExternalRequest(request) {
    if (request.method !== 'GET') return false;

    return ALLOWED_EXTERNAL_ORIGINS.has(new URL(request.url).origin);
}

function isAllowedExternalUrl(url) {
    return ALLOWED_EXTERNAL_ORIGINS.has(url.origin);
}

function isLocalUrl(url) {
    return url.origin === self.location.origin;
}

async function fetchFresh(request) {
    return fetch(request, { cache: 'no-store' });
}

async function fetchExternal(request) {
    return fetch(request);
}

function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function retry(operation, label) {
    let lastError;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        if (RETRY_DELAYS[attempt]) await wait(RETRY_DELAYS[attempt]);

        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (attempt + 1 < MAX_ATTEMPTS) {
                console.warn(`[SW] Retry ${attempt + 1}/${MAX_ATTEMPTS - 1} for ${label}:`, error);
            }
        }
    }

    throw lastError || new Error(`Request failed: ${label}`);
}

async function mapLimited(items, limit, operation) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function runWorker() {
        while (true) {
            const index = nextIndex;
            nextIndex += 1;
            if (index >= items.length) return;

            try {
                results[index] = {
                    status: 'fulfilled',
                    value: await operation(items[index], index)
                };
            } catch (reason) {
                results[index] = { status: 'rejected', reason };
            }
        }
    }

    await Promise.all(Array.from(
        { length: Math.min(limit, items.length) },
        () => runWorker()));

    return results;
}

function resourceUrlsFromCss(css, baseUrl) {
    return [...css.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^)]*))\s*\)/gi)]
        .map(match => match[1] || match[2] || match[3].trim())
        .filter(value => value && !value.startsWith('data:'))
        .map(value => {
            try {
                return new URL(value, baseUrl);
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}

function getReferencedUrls(html, responseUrl) {
    const baseMatch = html.match(/<base\b[^>]*href=["']([^"']+)["']/i);
    const baseUrl = new URL(baseMatch ? baseMatch[1] : responseUrl, responseUrl);
    const references = new Map();

    const addReference = value => {
        try {
            const url = withoutHash(new URL(value, baseUrl));
            if (!isLocalUrl(url)) return;
            references.set(url.href, url);
        } catch {
            return;
        }
    };

    for (const match of html.matchAll(/\bsrc\s*=\s*["']([^"']+)["']/gi)) {
        addReference(match[1]);
    }

    for (const match of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
        match[1].split(',').forEach(candidate => addReference(candidate.trim().split(/\s+/)[0]));
    }

    for (const match of html.matchAll(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
        addReference(match[1]);
    }

    for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
        if (/\.pdf(?:[?#]|$)/i.test(match[1])) addReference(match[1]);
    }

    return [...references.values()];
}

async function cacheResponseAt(cache, response, requests) {
    const urls = new Map();
    requests.forEach(request => {
        const url = withoutHash(new URL(request.url || request));
        urls.set(url.href, new Request(url.href));
    });

    if (response.url) {
        const finalUrl = withoutHash(new URL(response.url));
        urls.set(finalUrl.href, new Request(finalUrl.href));
    }

    for (const request of urls.values()) {
        await cache.put(request, response.clone());
    }
}

async function nonRedirectedResponse(response) {
    return new Response(await response.clone().arrayBuffer(), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
    });
}

async function cacheRouteResponseAt(cache, response, request) {
    const routeUrl = withoutHash(new URL(request.url || request));
    const aliases = [routeUrl];

    if (!routeUrl.pathname.endsWith('/')) {
        const slashUrl = new URL(routeUrl.href);
        slashUrl.pathname += '/';
        aliases.push(slashUrl);
    }

    await cacheResponseAt(cache, await nonRedirectedResponse(response), aliases);
}

function getFailureMessage(error) {
    return error instanceof Error ? error.message : String(error);
}

async function cacheLocalAsset(cache, url) {
    const sourceUrl = withoutHash(new URL(url.href || url));
    const cacheKey = withoutSearch(new Request(sourceUrl.href)).url;
    if (localRequestsInFlight.has(cacheKey)) return localRequestsInFlight.get(cacheKey);

    const operation = (async () => {
        const request = new Request(sourceUrl.href);
        const response = await retry(async () => {
            const freshResponse = await fetchFresh(request);
            if (!isCacheableResponse(freshResponse)) {
                throw new Error(`Unexpected response for ${sourceUrl.href}: ${freshResponse.status}`);
            }
            return freshResponse;
        }, sourceUrl.href);

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/css')) {
            const css = await response.clone().text();
            const nestedUrls = resourceUrlsFromCss(css, response.url || sourceUrl.href)
                .filter(isLocalUrl);
            const results = await mapLimited(nestedUrls, CACHE_CONCURRENCY,
                nestedUrl => cacheLocalAsset(cache, nestedUrl));
            const failure = results.find(result => result.status === 'rejected');
            if (failure) throw failure.reason;
        }

        await cacheResponseAt(cache, response, [sourceUrl]);
        return response;
    })();

    localRequestsInFlight.set(cacheKey, operation);
    try {
        return await operation;
    } finally {
        localRequestsInFlight.delete(cacheKey);
    }
}

function externalAsset(url, mode = 'cors') {
    return { url: url.href || url, mode };
}

async function cacheExternalAsset(cache, asset) {
    const sourceUrl = withoutHash(new URL(asset.url));
    if (!isAllowedExternalUrl(sourceUrl)) {
        throw new Error(`External origin is not allowlisted: ${sourceUrl.origin}`);
    }

    const key = sourceUrl.href;
    if (externalRequestsInFlight.has(key)) return externalRequestsInFlight.get(key);

    const operation = (async () => {
        const request = new Request(sourceUrl.href, {
            credentials: 'omit',
            mode: asset.mode || 'cors'
        });
        const response = await retry(async () => {
            const freshResponse = await fetchExternal(request);
            if (!isCacheableResponse(freshResponse)) {
                throw new Error(`Unexpected response for ${sourceUrl.href}: ${freshResponse.status}`);
            }
            return freshResponse;
        }, sourceUrl.href);

        await cache.put(request, response.clone());

        const contentType = response.headers.get('content-type') || '';
        const failures = [];
        const nestedUrls = [];
        if (response.type !== 'opaque' && contentType.includes('text/css')) {
            const css = await response.clone().text();
            const nestedAssets = resourceUrlsFromCss(css, response.url || sourceUrl.href)
                .filter(isAllowedExternalUrl)
                .map(url => externalAsset(url, 'cors'));
            nestedUrls.push(...nestedAssets.map(nested => withoutHash(new URL(nested.url)).href));
            const results = await mapLimited(nestedAssets, CACHE_CONCURRENCY,
                nested => cacheExternalAsset(cache, nested));
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    failures.push({
                        url: nestedAssets[index].url,
                        error: getFailureMessage(result.reason)
                    });
                } else if (result.value.failures) {
                    failures.push(...result.value.failures);
                }
            });
        }

        return { response, failures, nestedUrls };
    })();

    externalRequestsInFlight.set(key, operation);
    try {
        return await operation;
    } finally {
        externalRequestsInFlight.delete(key);
    }
}

async function cachePageDependencies(cache, response) {
    const html = await response.clone().text();
    const references = getReferencedUrls(html, response.url);
    const results = await mapLimited(references, CACHE_CONCURRENCY,
        reference => cacheLocalAsset(cache, reference));

    return results
        .map((result, index) => result.status === 'rejected' ? {
            url: references[index].href,
            error: getFailureMessage(result.reason)
        } : null)
        .filter(Boolean);
}

async function cacheLocalAssets(cache) {
    const results = await mapLimited(LOCAL_ASSETS_TO_CACHE, CACHE_CONCURRENCY,
        asset => cacheLocalAsset(cache, new URL(asset, self.registration.scope)));
    const failures = results
        .map((result, index) => result.status === 'rejected' ? {
            url: LOCAL_ASSETS_TO_CACHE[index],
            error: getFailureMessage(result.reason)
        } : null)
        .filter(Boolean);

    if (failures.length) {
        throw new Error(`Required local assets failed: ${JSON.stringify(failures)}`);
    }
}

async function getManifest() {
    const manifestUrl = new URL('offline-manifest.json', self.registration.scope);
    const response = await retry(async () => {
        const freshResponse = await fetchFresh(manifestUrl);
        if (!freshResponse.ok) {
            throw new Error(`Offline manifest returned ${freshResponse.status}`);
        }
        return freshResponse;
    }, manifestUrl.href);
    const manifest = await response.json();

    if (!Array.isArray(manifest.routes)) {
        throw new Error('Offline manifest has no routes array');
    }

    return manifest.routes;
}

async function cacheGeneratedRoutes(cache) {
    const routes = await getManifest();
    const routeUrls = routes.map(route => new URL(route, self.registration.scope));
    const pages = await mapLimited(routeUrls, CACHE_CONCURRENCY, async routeUrl => {
        const request = new Request(routeUrl.href);
        const response = await retry(async () => {
            const freshResponse = await fetchFresh(request);
            const contentType = freshResponse.headers.get('content-type') || '';
            if (!freshResponse.ok || !contentType.includes('text/html')) {
                throw new Error(`Generated route returned ${freshResponse.status}: ${routeUrl.href}`);
            }
            return freshResponse;
        }, routeUrl.href);
        const failures = await cachePageDependencies(cache, response);
        if (failures.length) {
            throw new Error(`Route dependencies failed: ${JSON.stringify(failures)}`);
        }
        await cacheRouteResponseAt(cache, response, routeUrl);
        return response;
    });

    const failures = pages
        .map((result, index) => result.status === 'rejected' ? {
            url: routeUrls[index].href,
            error: getFailureMessage(result.reason)
        } : null)
        .filter(Boolean);

    if (failures.length) {
        throw new Error(`Generated routes failed: ${JSON.stringify(failures)}`);
    }
}

async function precacheExternalAssets(cache) {
    const results = await mapLimited(EXTERNAL_ASSETS_TO_CACHE, CACHE_CONCURRENCY,
        asset => cacheExternalAsset(cache, asset));
    const failures = [];
    const requiredUrls = new Set(EXTERNAL_ASSETS_TO_CACHE.map(asset =>
        withoutHash(new URL(asset.url)).href));

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            failures.push({
                url: EXTERNAL_ASSETS_TO_CACHE[index].url,
                error: getFailureMessage(result.reason)
            });
        } else if (result.value.failures) {
            failures.push(...result.value.failures);
            result.value.nestedUrls?.forEach(url => requiredUrls.add(url));
        } else if (result.value.nestedUrls) {
            result.value.nestedUrls.forEach(url => requiredUrls.add(url));
        }
    });

    failures.forEach(failure => {
        console.warn('[SW] Third-party asset was not cached:', failure.url, failure.error);
    });
    return { failures, requiredUrls: [...requiredUrls] };
}

async function retryMissingExternalAssets(cache) {
    const status = await getOfflineStatus(cache);
    const configuredAssets = new Map(EXTERNAL_ASSETS_TO_CACHE.map(asset => [
        withoutHash(new URL(asset.url)).href,
        asset
    ]));
    const missingAssets = [...new Set(status.externalFailures.map(failure => failure.url))]
        .map(url => configuredAssets.get(url) || externalAsset(url, 'cors'));

    if (!missingAssets.length) {
        return { failures: [], requiredUrls: status.externalRequired || [] };
    }

    const results = await mapLimited(missingAssets, CACHE_CONCURRENCY,
        asset => cacheExternalAsset(cache, asset));
    const failures = [];
    const requiredUrls = new Set(status.externalRequired || []);
    missingAssets.forEach(asset => requiredUrls.add(withoutHash(new URL(asset.url)).href));

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            failures.push({
                url: missingAssets[index].url,
                error: getFailureMessage(result.reason)
            });
        } else {
            result.value.nestedUrls?.forEach(url => requiredUrls.add(url));
            if (result.value.failures) failures.push(...result.value.failures);
        }
    });

    failures.forEach(failure => {
        console.warn('[SW] Third-party asset was not cached:', failure.url, failure.error);
    });
    return { failures, requiredUrls: [...requiredUrls] };
}

function statusRequest() {
    return new Request(new URL(STATUS_PATH, self.registration.scope).href);
}

async function writeOfflineStatus(cache, externalResult) {
    const previousResponse = await cache.match(statusRequest());
    const previous = previousResponse ? await previousResponse.json() : null;
    const localRequired = previous?.localRequired || (await cache.keys())
        .map(request => request.url)
        .filter(url => new URL(url).origin === self.location.origin);
    await cache.put(statusRequest(), new Response(JSON.stringify({
        version: CACHE_NAME,
        localReady: true,
        localRequired,
        externalRequired: externalResult.requiredUrls,
        externalFailures: externalResult.failures,
        updatedAt: new Date().toISOString()
    }), {
        headers: { 'Content-Type': 'application/json' }
    }));
}

async function getOfflineStatus(cache) {
    const response = await cache.match(statusRequest());
    if (!response) {
        return {
            version: CACHE_NAME,
            localReady: false,
            externalReady: false,
            externalFailures: []
        };
    }

    const stored = await response.json();
    const cachedUrls = new Set((await cache.keys()).map(request => request.url));
    const missingLocal = (stored.localRequired || [])
        .filter(url => !cachedUrls.has(url));
    const missingExternal = (stored.externalRequired || [])
        .filter(url => !cachedUrls.has(url));
    const externalFailures = [...(stored.externalFailures || [])];
    missingExternal.forEach(url => {
        if (!externalFailures.some(failure => failure.url === url)) {
            externalFailures.push({ url, error: 'Missing from offline cache' });
        }
    });

    return {
        ...stored,
        localReady: stored.localReady !== false && missingLocal.length === 0,
        missingLocal,
        externalFailures,
        externalReady: externalFailures.length === 0
    };
}

async function notifyOfflineStatus(cache) {
    const status = await getOfflineStatus(cache);
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ type: 'offline-status', ...status }));
}

async function promoteInstallCache() {
    const staging = await caches.open(INSTALL_CACHE_NAME);
    await caches.delete(CACHE_NAME);
    const target = await caches.open(CACHE_NAME);
    const requests = await staging.keys();
    const results = await mapLimited(requests, CACHE_CONCURRENCY, async request => {
        const response = await staging.match(request);
        if (!response) throw new Error(`Staged response disappeared: ${request.url}`);
        await target.put(request, response.clone());
    });
    const failure = results.find(result => result.status === 'rejected');
    if (failure) {
        await caches.delete(CACHE_NAME);
        throw failure.reason;
    }

    if ((await target.keys()).length !== requests.length) {
        await caches.delete(CACHE_NAME);
        throw new Error('Offline cache promotion did not preserve every entry');
    }

    await caches.delete(INSTALL_CACHE_NAME);
}

async function cacheFreshHtml(cache, request, response) {
    const failures = await cachePageDependencies(cache, response);
    if (failures.length) {
        failures.forEach(failure => {
            console.warn('[SW] Updated page dependency was not cached:', failure.url, failure.error);
        });
        return { cached: false, failures };
    }

    await cacheRouteResponseAt(cache, response, request);
    return { cached: true, failures: [] };
}

function findCachedNavigation(cache, request) {
    const requestedUrl = withoutHash(new URL(request.url));
    const aliases = [requestedUrl];
    if (requestedUrl.pathname.endsWith('/')) {
        const cleanUrl = new URL(requestedUrl.href);
        cleanUrl.pathname = cleanUrl.pathname.slice(0, -1) || '/';
        aliases.push(cleanUrl);
    } else {
        const slashUrl = new URL(requestedUrl.href);
        slashUrl.pathname += '/';
        aliases.push(slashUrl);
    }

    return aliases.reduce(
        (promise, alias) => promise.then(response => response || cache.match(alias, { ignoreSearch: true })),
        Promise.resolve(null)
    );
}

function offlineErrorResponse(url) {
    return new Response(`Offline resource unavailable: ${url}`, {
        status: 503,
        statusText: 'Offline resource unavailable',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
}

async function handleNavigation(request) {
    const cache = await caches.open(CACHE_NAME);

    if (self.navigator.onLine === false) {
        const cachedRoute = await findCachedNavigation(cache, request);
        if (cachedRoute) return cachedRoute;
    }

    try {
        const fetchedResponse = await fetchFresh(request);
        const response = fetchedResponse.redirected && isLocalUrl(new URL(fetchedResponse.url))
            ? await nonRedirectedResponse(fetchedResponse)
            : fetchedResponse;
        const contentType = response.headers.get('content-type') || '';

        if (response.ok && contentType.includes('text/html')) {
            const result = await cacheFreshHtml(cache, request, response.clone());
            if (!result.cached) {
                console.warn('[SW] Kept the previous complete page for:', request.url);
            }
        } else if (isCacheableResponse(response)) {
            await cacheResponseAt(cache, response, [request]);
        }

        return response;
    } catch (error) {
        const cachedRoute = await findCachedNavigation(cache, request);
        if (cachedRoute) return cachedRoute;

        console.warn('[SW] Navigation fetch failed:', request.url, error);
        const cachedHome = await cache.match(new URL('index.html', self.registration.scope), {
            ignoreSearch: true
        });
        return cachedHome || offlineErrorResponse(request.url);
    }
}

async function handleLocalAsset(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const fallback = await cache.match(request, { ignoreSearch: true });
    const hasVersionQuery = new URL(request.url).search !== '';
    if (fallback && (!hasVersionQuery || self.navigator.onLine === false)) return fallback;

    try {
        return await cacheLocalAsset(cache, new URL(request.url));
    } catch (error) {
        console.warn('[SW] Local asset fetch failed:', request.url, error);
        return fallback || offlineErrorResponse(request.url);
    }
}

async function handleExternalAsset(request) {
    const cache = await caches.open(CACHE_NAME);
    const asset = { url: request.url, mode: request.mode === 'no-cors' ? 'no-cors' : 'cors' };
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
        const result = await cacheExternalAsset(cache, asset);
        result.failures.forEach(failure => {
            console.warn('[SW] Nested third-party asset was not cached:', failure.url, failure.error);
        });
        return result.response;
    } catch (error) {
        console.warn('[SW] Third-party asset fetch failed:', request.url, error);
        return await cache.match(request) || offlineErrorResponse(request.url);
    }
}

async function refreshRoute(urlValue) {
    const url = new URL(urlValue);
    const scopeUrl = new URL(self.registration.scope);
    if (url.origin !== self.location.origin || !url.pathname.startsWith(scopeUrl.pathname)) {
        throw new Error(`Refresh URL is outside the service-worker scope: ${url.href}`);
    }

    const request = new Request(url.href, { method: 'GET', cache: 'no-store' });
    const response = await retry(async () => {
        const freshResponse = await fetchFresh(request);
        const contentType = freshResponse.headers.get('content-type') || '';
        if (!freshResponse.ok || !contentType.includes('text/html')) {
            throw new Error(`Refresh route returned ${freshResponse.status}: ${url.href}`);
        }
        return freshResponse;
    }, url.href);
    const cache = await caches.open(CACHE_NAME);
    return cacheFreshHtml(cache, request, response);
}

function replyToMessage(event, payload) {
    if (event.ports && event.ports[0]) event.ports[0].postMessage(payload);
}

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        await caches.delete(INSTALL_CACHE_NAME);
        const cache = await caches.open(INSTALL_CACHE_NAME);
        try {
            await cacheLocalAssets(cache);
            await cacheGeneratedRoutes(cache);
            const externalResult = await precacheExternalAssets(cache);
            await writeOfflineStatus(cache, externalResult);
            await promoteInstallCache();
            await self.skipWaiting();
        } catch (error) {
            await caches.delete(INSTALL_CACHE_NAME);
            throw error;
        }
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => caches.delete(cacheName)));
        await self.clients.claim();
    })());
});

self.addEventListener('message', event => {
    const message = event.data || {};

    if (message.type === 'retry-external-assets') {
        event.waitUntil((async () => {
            const cache = await caches.open(CACHE_NAME);
            const externalResult = await retryMissingExternalAssets(cache);
            await writeOfflineStatus(cache, externalResult);
            const status = await getOfflineStatus(cache);
            await notifyOfflineStatus(cache);
            replyToMessage(event, { ok: status.externalReady, ...status });
        })().catch(error => {
            console.warn('[SW] Third-party retry failed:', error);
            replyToMessage(event, { ok: false, failures: [{ error: getFailureMessage(error) }] });
        }));
        return;
    }

    if (message.type === 'get-offline-status') {
        event.waitUntil((async () => {
            const cache = await caches.open(CACHE_NAME);
            const status = await getOfflineStatus(cache);
            await notifyOfflineStatus(cache);
            replyToMessage(event, status);
        })().catch(error => {
            replyToMessage(event, { version: CACHE_NAME, localReady: false, externalReady: false,
                error: getFailureMessage(error) });
        }));
        return;
    }

    if (message.type === 'refresh-route') {
        event.waitUntil(refreshRoute(message.url)
            .then(result => replyToMessage(event, { ok: result.cached, ...result }))
            .catch(error => {
                console.warn('[SW] Route refresh failed:', message.url, error);
                replyToMessage(event, { ok: false, error: getFailureMessage(error) });
            }));
    }
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    if (request.mode === 'navigate') {
        event.respondWith(handleNavigation(request));
        return;
    }

    if (isLocalAssetRequest(request)) {
        event.respondWith(handleLocalAsset(request));
        return;
    }

    if (isAllowedExternalRequest(request)) {
        event.respondWith(handleExternalAsset(request));
    }
});
