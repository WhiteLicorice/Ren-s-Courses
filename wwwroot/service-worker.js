const CACHE_NAME = 'ren-courses-v1';
const ASSETS_TO_CACHE = [
    './',
    'index.html',
    'css/app.css',
    'site.webmanifest.json',
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'apple-touch-icon.png'
];

// 1. INSTALL: Cache critical assets immediately
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); // Activate worker immediately
});

// 2. ACTIVATE: Clean up old caches
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

// 3. FETCH: Network First, Fallback to Cache
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Allow the current origin OR specific CDNs
    const allowedDomains = [
        self.location.hostname,        // Website
        'fonts.googleapis.com',        // Fonts CSS
        'fonts.gstatic.com',           // Font Files
        'cdn.jsdelivr.net',            // Prism Theme
        'cdnjs.cloudflare.com'         // Prism Scripts
    ];

    // If the request isn't in our allowed list, let the browser handle it normally
    if (!allowedDomains.some(domain => url.hostname.includes(domain))) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Check if we got a valid response
                if (!response || response.status !== 200 || response.type !== 'basic' && response.type !== 'cors') {
                    return response;
                }

                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});