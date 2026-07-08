// Bumped again — reports of the hero redesign (darker gradient, Navbar
// fix) not showing up after deploy, same "stale cache" class of issue as
// last time this got bumped. See `activate` below, which already deletes
// any cache key that isn't this one.
const CACHE_NAME = 'atp-v3';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [OFFLINE_URL, '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Cache Storage can be unavailable or throw (seen on iOS Safari under
  // some private-browsing/storage-restricted conditions) — a broken cache
  // must never break the actual page. Every branch below falls back to a
  // plain, uncached `fetch(request)` if anything cache-related rejects.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match(OFFLINE_URL)
          .then((offline) => offline ?? Response.error())
          .catch(() => Response.error()),
      ),
    );
    return;
  }

  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
      .catch(() => fetch(request)),
  );
});
