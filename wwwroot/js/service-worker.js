const CACHE_NAME = 'ren-courses-v1';
const ASSETS_TO_CACHE = [
    './',
    'index.html',
    'css/app.css',
    'css/site.css',
    'js/site.js',
    'site.webmanifest',
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'apple-touch-icon.png'
];

// 1. INSTALL
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching app shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// 2. ACTIVATE
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 3. FETCH
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Filter allowed domains
    const allowedDomains = [
        self.location.hostname,
        'fonts.googleapis.com',
        'fonts.gstatic.com',
        'cdn.jsdelivr.net',
        'cdnjs.cloudflare.com'
    ];

    if (!allowedDomains.some(domain => url.hostname.includes(domain))) {
        return;
    }

    // NETWORK FIRST, FALLBACK TO CACHE
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Check if valid response
                if (!response || response.status !== 200 || response.type !== 'basic' && response.type !== 'cors') {
                    return response;
                }

                // Clone and Cache
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            })
            .catch(() => {
                // OFFLINE STRATEGY
                return caches.match(event.request).then((response) => {
                    if (response) {
                        return response; // Return cached file
                    }

                    // If not in cache, and it's a page navigation, return Home/Index
                    // This prevents the "No Internet" dinosaur screen.
                    if (event.request.mode === 'navigate') {
                        return caches.match('index.html');
                    }
                });
            })
    );
});