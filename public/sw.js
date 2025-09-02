const CACHE_NAME = 'schikko-rules-cache-v4';
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
    // Do not call respondWith so the request bypasses the SW and follows CSP type directives (style-src, font-src, etc.)
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;
      return fetch(event.request);
    })
  );
});

// Update a service worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});