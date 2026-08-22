// Bumped again — the CMS (`/admin/`) was serving a stale `config.yml`
// (new fields not showing up after deploy) because it hit the same
// stale-while-revalidate branch as everything else below, which answers
// from cache first. Fixed by excluding `/admin/` from the cache entirely
// (see the early return in `fetch` below) — an editing tool has to always
// be fresh, unlike the public pages this cache is actually for. Bumping
// the version once more here to flush whatever's already cached from
// before that fix. See `activate` below, which already deletes any cache
// key that isn't this one.
const CACHE_NAME = 'atp-v4';
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

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The CMS lives here: config.yml and its own JS have to reflect the
  // latest deploy right away (a stale schema means fields the person just
  // added silently don't show up), so it's excluded from the cache
  // entirely instead of getting the stale-while-revalidate treatment below
  // — `return` without `respondWith` leaves the request to the browser's
  // normal (uncached-by-us) handling.
  if (url.pathname.startsWith('/admin')) return;

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
