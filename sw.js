import { VERSION } from './config.js';

const CACHE_NAME = `4-in-a-row-v${VERSION}`;

const APP_SHELL_FILES = [
    '/',
    '/index.html',
    '/styles.css',
];

const JS_FILES = [
    '/index.js',
    '/config.js',
    '/Board.js',
    '/BoardRenderer.js',
    '/GameController.js',
    '/InputHandler.js',
    '/Stone.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log(`[Service Worker] Caching app shell for version ${VERSION}`);
                // Cache the app shell (non-JS files)
                cache.addAll(APP_SHELL_FILES);
                
                // Cache the versioned JS files
                const versionedJsFiles = JS_FILES.map(file => `${file}?v=${VERSION}`);
                return cache.addAll(versionedJsFiles);
            })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // For JS files, try to find the versioned file in the cache.
    if (url.pathname.endsWith('.js')) {
        const versionedUrl = `${url.pathname}?v=${VERSION}`;
        event.respondWith(
            caches.match(versionedUrl)
                .then(cachedResponse => {
                    // If we have the versioned file in cache, serve it.
                    // Otherwise, it's a bug or a file we don't cache, so fetch from network.
                    return cachedResponse || fetch(event.request);
                })
        );
    } else {
        // For non-JS files, use a standard cache-first strategy.
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    return response || fetch(event.request);
                })
        );
    }
}); 