// Keeps a copy of the app on the device so it opens and plays with no connection.
// Serves the saved copy first, then quietly fetches a fresh one for next time.
const CACHE = 'daily-puzzles-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // every page address is the same app, so navigations use the saved home page
  const key = req.mode === 'navigate' ? '/' : url.pathname;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const saved = await cache.match(key);
    const fresh = fetch(req).then((res) => {
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    }).catch(() => null);
    if (saved) { e.waitUntil(fresh); return saved; }
    return (await fresh) || new Response('Offline and not saved yet. Open the app once while online.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }));
});
