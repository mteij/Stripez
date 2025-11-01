const CACHE_NAME = 'schikko-rules-cache-v7';
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

// Cache only same-origin GET requests; bypass caching for API and non-GET to avoid Cache.put POST errors
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Let the browser handle cross-origin or non-GET requests
  if (url.origin !== self.location.origin || req.method !== 'GET') {
    return;
  }

  // Never cache API requests
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(req).then(response => {
        const fetchPromise = fetch(req).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            // Only cache safe GET requests
            cache.put(req, networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
          console.error('Fetch failed', err);
          // Fallback to cache if available
          return response;
        });
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