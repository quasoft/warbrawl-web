const cacheName = "warbrawl-0.1.0-a8f72eee56bc4b818b83e74326054739";
const contentToCache = [
    "index.html",
    "manifest.webmanifest",
    "TemplateData/style.css",
    "Build/Web.data",
    "Build/Web.framework.js",
    "Build/Web.loader.js",
    "Build/Web.wasm"
];

self.addEventListener('install', function (e) {
    self.skipWaiting();
    e.waitUntil((async function () {
        const cache = await caches.open(cacheName);
        // no-cache: revalidate against the server so a stale HTTP cache can't
        // seed the new build's cache with old files
        await cache.addAll(contentToCache.map(function (url) {
            return new Request(url, { cache: 'no-cache' });
        }));
    })());
});

self.addEventListener('activate', function (e) {
    e.waitUntil((async function () {
        const keys = await caches.keys();
        await Promise.all(keys.filter(function (k) { return k !== cacheName; })
            .map(function (k) { return caches.delete(k); }));
        await clients.claim();
    })());
});

self.addEventListener('fetch', function (e) {
    if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin)
        return; // let Photon/API traffic and POSTs pass through untouched

    // Navigations are network-first so a deploy is picked up on the next load;
    // cached copy is only a fallback for offline.
    if (e.request.mode === 'navigate') {
        e.respondWith((async function () {
            try {
                return await fetch(e.request.url, { cache: 'no-cache' });
            } catch (err) {
                const cached = await caches.match('index.html', { cacheName: cacheName });
                if (cached) return cached;
                throw err;
            }
        })());
        return;
    }

    // Everything else is cache-first, scoped to THIS build's cache only.
    e.respondWith((async function () {
        const cache = await caches.open(cacheName);
        let response = await cache.match(e.request);
        if (response) return response;
        response = await fetch(e.request);
        if (response.ok) cache.put(e.request, response.clone());
        return response;
    })());
});
