const CACHE_NAME = 'debtx-cache-v1';
const OFFLINE_URL = 'index.html';
const PRECACHE_ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'manifest.json',
  'icons/icon-192.svg',
  'icons/icon-512.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestURL = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          cacheClone(event.request, response.clone());
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  if (requestURL.origin !== location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        return cached;
      }
      return fetch(event.request)
        .then(response => {
          cacheClone(event.request, response.clone());
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL));
    })
  );
});

function cacheClone(request, response) {
  if (!response || response.status !== 200 || response.type !== 'basic') {
    return;
  }
  caches.open(CACHE_NAME).then(cache => {
    cache.put(request, response);
  });
}
