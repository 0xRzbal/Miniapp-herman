const CACHE = 'rzbal-hub-v3';

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const passthrough = (url) =>
  url.pathname.startsWith('/api/') ||
  url.pathname.startsWith('/mail/') ||
  url.pathname.startsWith('/9router/') ||
  url.pathname.startsWith('/socket.io/');

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (passthrough(url)) return;

  // Hashed assets and fonts are immutable: cache-first, refreshed in background.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/')) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(e.request);
        const network = fetch(e.request)
          .then((res) => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || network;
      }),
    );
    return;
  }

  // HTML (index shell): network-first so a new deploy lands immediately, cache only as offline fallback.
  if (e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(e.request)) || (await caches.match('/')) || Response.error()),
    );
  }
});
