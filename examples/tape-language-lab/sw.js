const CACHE = 'tape-language-lab-v24';
const FILES = ['./', './index.html', './style.css', './src/app.js', './src/machine.js', './src/examples.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  // This origin may host other experiments; never delete another app's caches.
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(event.request) || Response.error();
  }));
});
