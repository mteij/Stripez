const CACHE_NAME = 'schikko-rules-cache-v6';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/js/main.js',
  '/js/firebase.js',
  '/js/ui.js',
  '/randomizer/randomizer.js',
  '/randomizer/randomizer.css',
  '/assets/favicon.png'
];

// Install a service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Only cache same-origin assets to comply with CSP connect-src
        const safeUrls = urlsToCache.filter(u => !(u.startsWith('http://') || u.startsWith('https://')));
        return cache.addAll(safeUrls);
      })
      .then(() => self.skipWaiting())
      .catch(err => {
        console.error('Cache install failed', err);
      })
  );
});

// Cache only same-origin requests to respect CSP; let browser handle cross-origin (e.g., Google Fonts)
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(event.request).then(response => {
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    // If the request is successful, update the cache
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(err => {
                    console.error('Fetch failed', err);
                    // Optionally, return a fallback page if offline
                });

                // Return cached response if available, otherwise wait for the network
                return response || fetchPromise;
            });
        })
    );
});

// Update a service worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(clients => {
        // Notify all open pages to reload so new assets are applied immediately
        clients.forEach(client => client.postMessage({ type: 'reload' }));
      })
  );
});