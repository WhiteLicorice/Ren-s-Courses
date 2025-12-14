const CACHE_NAME = 'ren-courses-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/app.css',
    '/site.webmanifest.json',
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
    'apple-touch-icon'
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
    // Skip cross-origin requests (like Google Fonts or Analytics) if you want strict control
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // If network works, return response AND cache it for offline use next time
                // We clone the response because it's a stream and can only be consumed once
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            })
            .catch(() => {
                // If network fails, try to serve from cache
                return caches.match(event.request);
            })
    );
});