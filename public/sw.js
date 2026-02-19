const CACHE_NAME = 'schikko-rules-cache-v11';
const urlsToCache = [
  '/',
  // '/index.html', // Removed: server generates this, not a static file
  '/style.css',
  '/js/main.js',
  '/js/api.js',
  '/js/ui.js',
  '/randomizer/randomizer.js',
  '/randomizer/randomizer.css',
  '/assets/favicon.png'
];

// Install a service worker
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      // Only cache same-origin assets to comply with CSP connect-src
      const safeUrls = urlsToCache.filter(u => !(u.startsWith('http://') || u.startsWith('https://')));
      // Add each entry individually; skip failures to avoid aborting the whole install
      await Promise.all(safeUrls.map(async (u) => {
        try {
          await cache.add(u);
        } catch (e) {
          console.warn('SW: skip caching', u, e && (e.message || e));
        }
      }));
      await self.skipWaiting();
    } catch (err) {
      console.error('Cache install failed', err);
    }
  })());
});

// Cache strategies
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

  // Network-First for HTML navigation (ensure freshness)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(req, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          return caches.match(req);
        })
    );
    return;
  }

  // Stale-While-Revalidate for other assets (CSS/JS/etc)
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(req).then(cachedResponse => {
        const fetchPromise = fetch(req).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(req, networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
          console.error('Fetch failed', err);
          return cachedResponse;
        });
        return cachedResponse || fetchPromise;
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