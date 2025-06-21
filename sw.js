import { VERSION } from './config.js';

const CACHE_NAME = `4-in-a-row-v${VERSION}`;

console.log(`[Service Worker] Starting with VERSION: ${VERSION}`);
console.log(`[Service Worker] Cache name: ${CACHE_NAME}`);

// All files that make up the app shell
const APP_SHELL_FILES = [
    '/index.html',
    '/styles.css',
    '/index.js',
    '/config.js',
    '/Board.js',
    '/BoardRenderer.js',
    '/GameController.js',
    '/InputHandler.js',
    '/Stone.js'
];

// On install, cache all app shell files
self.addEventListener('install', event => {
    console.log(`[Service Worker] Install event triggered for version ${VERSION}`);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log(`[Service Worker] Opened cache: ${CACHE_NAME}`);
                console.log(`[Service Worker] Starting to fetch ${APP_SHELL_FILES.length} files with cache busting...`);
                
                // Force fresh fetches by adding cache-busting parameters during install
                const fetchPromises = APP_SHELL_FILES.map(url => {
                    const bustUrl = `${url}?cb=${Date.now()}`;
                    console.log(`[Service Worker] Fetching fresh: ${bustUrl}`);
                    return fetch(bustUrl).then(response => {
                        console.log(`[Service Worker] Successfully fetched ${url}, status: ${response.status}`);
                        // Store the response in cache using the clean URL (without cache-buster)
                        return cache.put(url, response.clone()).then(() => {
                            console.log(`[Service Worker] Cached: ${url}`);
                        });
                    }).catch(error => {
                        console.error(`[Service Worker] Failed to fetch ${url}:`, error);
                        throw error;
                    });
                });
                
                return Promise.all(fetchPromises).then(() => {
                    console.log(`[Service Worker] All files cached successfully for version ${VERSION}`);
                });
            })
    );
});

// On activate, delete old caches
self.addEventListener('activate', event => {
    console.log(`[Service Worker] Activate event triggered for version ${VERSION}`);
    event.waitUntil(
        caches.keys().then(cacheNames => {
            console.log(`[Service Worker] Found existing caches:`, cacheNames);
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    } else {
                        console.log(`[Service Worker] Keeping current cache: ${cacheName}`);
                    }
                })
            );
        }).then(() => {
            console.log(`[Service Worker] Activation complete for version ${VERSION}`);
        })
    );
});

// On fetch, serve from cache, but inject version params into index.html
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // If the request is for index.html, modify it on the fly
    if (url.pathname === '/' || url.pathname === '/index.html') {
        console.log(`[Service Worker] Intercepting HTML request: ${url.pathname}`);
        event.respondWith(
            caches.match('/index.html')
                .then(response => {
                    if (!response) {
                        console.log(`[Service Worker] HTML not in cache, fetching from network`);
                        return fetch(event.request);
                    }
                    console.log(`[Service Worker] HTML found in cache, modifying with version ${VERSION}`);
                    return response.text().then(html => {
                        // Inject cache-busting query parameters
                        const versionedHtml = html
                            .replace('href="styles.css"', `href="styles.css?v=${VERSION}"`)
                            .replace('src="index.js"', `src="index.js?v=${VERSION}"`);
                        
                        console.log(`[Service Worker] HTML modified with version parameters`);
                        return new Response(versionedHtml, {
                            headers: { 'Content-Type': 'text/html' }
                        });
                    });
                })
        );
    } else {
        // For all other requests, use a simple cache-first strategy.
        console.log(`[Service Worker] Cache-first request for: ${url.pathname}`);
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        console.log(`[Service Worker] Serving from cache: ${url.pathname}`);
                        return response;
                    } else {
                        console.log(`[Service Worker] Not in cache, fetching from network: ${url.pathname}`);
                        return fetch(event.request);
                    }
                })
        );
    }
}); 