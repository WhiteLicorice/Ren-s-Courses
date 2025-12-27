const CACHE_NAME = 'ren-courses-online-first-v1';

// ONLY cache local files. 
// This ensures the SW installs successfully 100% of the time.
const ASSETS_TO_CACHE = [
    './',
    'index.html',
    'css/app.css',
    'css/code-styles.css',
    'js/site.js',
    'site.webmanifest',
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'apple-touch-icon.png'
];

// 1. INSTALL
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching local shell...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
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

// 3. FETCH (Network Only, with specific exclusions)
self.addEventListener('fetch', (event) => {
    // If it's a navigation request (HTML), try network first, then cache (for the shell)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match('index.html');
            })
        );
        return;
    }

    // For everything else (CSS/JS/Images), just let the browser handle it.
    // We do NOT intercept CDN requests here, avoiding the CORS/Opaque response issues.
    return;
});