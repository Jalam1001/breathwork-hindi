// Offline cache for BreathWork (Hindi). Shares the origin with the English site, so only touch our own caches. Bump VERSION when files change.
const PREFIX = 'breathwork-hi-';
const VERSION = PREFIX + 'v1.1.0';
const ASSETS = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'js/app.js', 'js/domain.js', 'js/cues.js', 'js/store.js', 'js/bg.js', 'js/theme.js', 'essay.html',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Cache first, then network (and refresh the cache in the background).
  e.respondWith(caches.open(VERSION).then((c) => c.match(req, { ignoreSearch: true })).then((hit) => {
    const net = fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; });
    if (hit) { net.catch(() => {}); return hit; }
    return net.catch(() => (req.mode === 'navigate' ? caches.open(VERSION).then((c) => c.match('index.html')) : Response.error()));
  }));
});
