/* Service worker: keeps a copy of the app on the device so it opens with no internet.

   How updates work: the app always opens instantly from the saved copy, and
   quietly downloads any newer version in the background. You see the new
   version the NEXT time you open the app.

   If you add a new file to the app, add it to FILES below and bump VERSION. */
const VERSION = 'penguins-v4';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

// Delete copies saved by older versions
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Answer from the saved copy right away; refresh the saved copy from the internet in the background
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  event.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true }) ||
                   (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    const fresh = fetch(req).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    if (cached) { event.waitUntil(fresh); return cached; }
    return fresh;
  }));
});
