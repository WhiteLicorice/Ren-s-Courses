const CACHE_NAME = 'ren-courses-online-first-v3';

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

function isCacheableResponse(response) {
    return response.ok || response.type === 'opaque';
}

function withoutSearch(request) {
    const url = new URL(request.url);
    url.search = '';
    url.hash = '';
    return new Request(url.href);
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

async function fetchFresh(request) {
    return fetch(request, { cache: 'no-store' });
}

async function cacheExternalAsset(cache, asset) {
    const request = new Request(asset.url, {
        credentials: 'omit',
        mode: asset.mode
    });
    const response = await fetchFresh(request);

    if (!isCacheableResponse(response)) {
        throw new Error(`Unexpected response for ${asset.url}: ${response.status}`);
    }

    await cache.put(request, response.clone());

    const contentType = response.headers.get('content-type') || '';
    if (response.type === 'opaque' || !contentType.includes('text/css')) return;

    const css = await response.text();
    const nestedUrls = [...css.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^)]*))\s*\)/gi)]
        .map(match => match[1] || match[2] || match[3].trim())
        .map(url => new URL(url, asset.url))
        .filter(url => ALLOWED_EXTERNAL_ORIGINS.has(url.origin))
        .map(url => ({ url: url.href, mode: 'cors' }));

    await Promise.allSettled(nestedUrls.map(nested => cacheExternalAsset(cache, nested)));
}

function getReferencedUrls(html, baseUrl) {
    return [...html.matchAll(/\bsrc\s*=\s*["']([^"']+)["']/gi)]
        .map(match => new URL(match[1], baseUrl))
        .filter(url => url.origin === self.location.origin);
}

async function cacheLocalAsset(cache, url) {
    const request = new Request(url.href);
    const response = await fetchFresh(request);

    if (!isCacheableResponse(response)) {
        throw new Error(`Unexpected response for ${url.href}: ${response.status}`);
    }

    await cache.put(withoutSearch(request), response);
}

async function cacheGeneratedRoutes(cache) {
    const manifestUrl = new URL('offline-manifest.json', self.registration.scope);
    const manifestResponse = await fetchFresh(manifestUrl);

    if (!manifestResponse.ok) {
        throw new Error(`Offline manifest returned ${manifestResponse.status}`);
    }

    const manifest = await manifestResponse.json();
    if (!Array.isArray(manifest.routes)) {
        throw new Error('Offline manifest has no routes array');
    }

    const referencedUrls = new Map();

    await Promise.all(manifest.routes.map(async route => {
        const request = new Request(new URL(route, self.registration.scope));
        const response = await fetchFresh(request);

        if (!response.ok) {
            throw new Error(`Generated route returned ${response.status}: ${route}`);
        }

        await cache.put(request, response.clone());

        const html = await response.text();
        getReferencedUrls(html, request.url)
            .filter(url => url.pathname !== new URL(request.url).pathname)
            .forEach(url => referencedUrls.set(url.href, url));
    }));

    const results = await Promise.allSettled(
        [...referencedUrls.values()].map(url => cacheLocalAsset(cache, url)));

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            const url = [...referencedUrls.values()][index];
            console.warn('[SW] Local referenced asset was not cached:', url.href, result.reason);
        }
    });
}

async function handleNavigation(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const response = await fetchFresh(request);
        const contentType = response.headers.get('content-type') || '';

        if (response.ok && contentType.includes('text/html')) {
            await cache.put(request, response.clone());
        }

        return response;
    } catch {
        const cachedRoute = await cache.match(request) ||
            await cache.match(request, { ignoreSearch: true });
        if (cachedRoute) return cachedRoute;

        const cachedHome = await cache.match(new URL('index.html', self.registration.scope));
        return cachedHome || Response.error();
    }
}

async function handleLocalAsset(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const response = await fetchFresh(request);
        if (isCacheableResponse(response)) {
            await cache.put(withoutSearch(request), response.clone());
        }
        return response;
    } catch {
        return await cache.match(request, { ignoreSearch: true }) || Response.error();
    }
}

async function handleExternalAsset(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const response = await fetchFresh(request);
        if (isCacheableResponse(response)) {
            await cache.put(request, response.clone());
        }
        return response;
    } catch {
        return await cache.match(request) || Response.error();
    }
}

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(LOCAL_ASSETS_TO_CACHE);
        await cacheGeneratedRoutes(cache);

        const results = await Promise.allSettled(
            EXTERNAL_ASSETS_TO_CACHE.map(asset => cacheExternalAsset(cache, asset)));

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.warn('[SW] Third-party asset was not cached:', EXTERNAL_ASSETS_TO_CACHE[index].url, result.reason);
            }
        });
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => Promise.all(
            cacheNames.map(cacheName => {
                if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
                return undefined;
            })
        ))
    );
    self.clients.claim();
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
