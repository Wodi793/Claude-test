/* Service worker: keeps a copy of the app on the device so it opens with no internet.

   How updates work: when you're online, the app is always loaded fresh from
   the internet (so new versions show up right away), and the saved copy is
   refreshed at the same time. With no internet, the saved copy is used.

   If you add a new file to the app, add it to FILES below and bump VERSION. */
const VERSION = 'penguins-v8';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png'];
const NETWORK_WAIT_MS = 3000;   // on a very slow connection, fall back to the saved copy after this

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

// Internet first (checking with the server, not the browser's memory); saved copy if offline
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  event.respondWith(caches.open(VERSION).then(async cache => {
    const fromNetwork = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    const timeout = new Promise(resolve => setTimeout(resolve, NETWORK_WAIT_MS));
    try {
      const res = await Promise.race([fromNetwork, timeout]);
      if (res) return res;
    } catch { /* offline: fall through to the saved copy */ }
    const cached = await cache.match(req, { ignoreSearch: true }) ||
                   (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    return cached || fromNetwork;
  }));
});
