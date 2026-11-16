// Offline support for the static workbench.
// Deployment convention (docs/deployment.md): file names carry no content hash
// and servers ask clients to revalidate. To honor that, this worker is
// network-first for every same-origin GET and keeps the latest successful
// responses in a versioned cache as an offline fallback only. Navigations
// fall back to the cached workbench entry so the app opens without a network.
const CACHE = 'motion-foundry-v1';
const ENTRY = './index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          ENTRY,
          './style.css',
          './workbench.js',
          './data.js',
          './renderer.js',
          './manifest.webmanifest',
          './icon.svg',
        ]),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(ENTRY, copy));
          return response;
        })
        .catch(() => caches.match(ENTRY).then((hit) => hit || Response.error())),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok || response.type === 'opaque') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || Response.error())),
  );
});
