// Hard-code VERSION to avoid module import issues in service worker
const VERSION = '0.10.0';
const CACHE_NAME = `4-in-a-row-v${VERSION}`;

// console.log(`[Service Worker] Starting with VERSION: ${VERSION}`);
// console.log(`[Service Worker] Cache name: ${CACHE_NAME}`);

// All files that make up the app shell
const APP_SHELL_FILES = [
    '/',
    '/index.html',
    '/styles.css',
    '/index.js',
    '/config.js',
    '/Board.js',
    '/BoardRenderer.js',
    '/GameController.js',
    '/InputHandler.js',
    '/Stone.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// On install, cache all app shell files
self.addEventListener('install', event => {
    // console.log(`[Service Worker] Install event triggered for version ${VERSION}`);
    // Take control immediately
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                // console.log(`[Service Worker] Opened cache: ${CACHE_NAME}`);
                // console.log(`[Service Worker] Caching app shell with clean URLs...`);

                // Force fresh fetches by adding cache-busting parameters during install
                const fetchPromises = APP_SHELL_FILES.map(url => {
                    // Always use a cache-buster to ensure we get a fresh version from the network
                    const fetchUrl = `${url}?cb=${Date.now()}`;
                    // console.log(`[Service Worker] Fetching fresh: ${fetchUrl}`);

                    return fetch(fetchUrl).then(response => {
                        if (!response.ok) {
                            throw new Error(`[Service Worker] Fetch failed for ${url}: ${response.status} ${response.statusText}`);
                        }
                        // console.log(`[Service Worker] Successfully fetched ${url}, status: ${response.status}`);
                        // Store the response in cache using the clean URL (without cache-buster)
                        return cache.put(url, response).then(() => {
                            // console.log(`[Service Worker] Cached clean URL: ${url}`);
                        });
                    }).catch(error => {
                        // console.error(`[Service Worker] Failed to fetch and cache ${url}:`, error);
                        throw error;
                    });
                });

                return Promise.all(fetchPromises).then(() => {
                    // console.log(`[Service Worker] All files cached successfully for version ${VERSION}`);
                });
            })
    );
});

// On activate, delete old caches
self.addEventListener('activate', event => {
    // console.log(`[Service Worker] Activate event triggered for version ${VERSION}`);
    // Take control of all clients immediately
    self.clients.claim();
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            // console.log(`[Service Worker] Found existing caches:`, cacheNames);
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        // console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    } else {
                        // console.log(`[Service Worker] Keeping current cache: ${cacheName}`);
                    }
                })
            );
        }).then(() => {
            // console.log(`[Service Worker] Activation complete for version ${VERSION}`);
        })
    );
});

// On fetch, serve from cache with simple cache-first strategy
self.addEventListener('fetch', event => {
    // Let the browser do its default thing
    // for non-GET requests.
    if (event.request.method !== 'GET') {
        return;
    }

    // Extract details for logging/debugging (optional)
    // const url = new URL(event.request.url);
    // console.log(`[Service Worker] FETCH EVENT - Full URL: ${url.href}`);
    // console.log(`[Service Worker] FETCH EVENT - Pathname: ${url.pathname}`);
    // console.log(`[Service Worker] FETCH EVENT - Search params: ${url.search}`);


    // For HTML pages, try the network first, then fall back to the cache.
    // This is a "Network falling back to cache" strategy.
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(response => {
            if (response) {
                // console.log(`[Service Worker] Serving from cache: ${event.request.url}`);
                return response;
            }
            // console.log(`[Service Worker] Not in cache, fetching from network: ${event.request.url}`);
            return fetch(event.request);
        })
    );
}); 