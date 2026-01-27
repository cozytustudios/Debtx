// Bump cache version whenever shipping UI fixes so phones update immediately.
const CACHE_NAME = 'debtx-cache-v9';
const FONT_CACHE = 'debtx-fonts-v1';
const OFFLINE_URL = 'index.html';

const PRECACHE_ASSETS = [
  './',
  'index.html',
  'style.css',
  'themes.css',
  'new_dock.css',
  'app.js',
  'manifest.json',
  'icon-192.svg',
  'icon-512.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clearOldCaches());
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const { request } = event;
  const requestURL = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isFontRequest(requestURL)) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  if (requestURL.origin !== location.origin) {
    return;
  }

  // Use SWR so CSS/JS updates propagate without requiring a manual cache clear.
  event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
});

async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    cacheClone(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(OFFLINE_URL);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

function cacheFirstThenNetwork(request) {
  return caches.match(request).then(cached => {
    if (cached) {
      return cached;
    }
    return fetch(request)
      .then(response => {
        cacheClone(request, response.clone());
        return response;
      })
      .catch(() => caches.match(OFFLINE_URL));
  });
}

function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then(cache =>
    cache.match(request).then(cached => {
      const networkFetch = fetch(request)
        .then(response => {
          cacheClone(request, response.clone(), cacheName);
          return response;
        })
        .catch(() => cached || caches.match(OFFLINE_URL));
      return cached || networkFetch;
    })
  );
}

function cacheClone(request, response, cacheName = CACHE_NAME) {
  if (!response || response.status !== 200 || response.type !== 'basic') {
    return;
  }
  caches.open(cacheName).then(cache => {
    cache.put(request, response);
  });
}

function isFontRequest(url) {
  return (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  );
}

function clearOldCaches() {
  return caches.keys().then(keys =>
    Promise.all(
      keys
        .filter(key => ![CACHE_NAME, FONT_CACHE].includes(key))
        .map(key => caches.delete(key))
    )
  );
}
