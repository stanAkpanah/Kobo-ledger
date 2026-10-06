/* Kobo Ledger service worker.
   Only stores the app's own files so it can open without internet.
   It never touches your data: GitHub requests always go straight to GitHub. */
const CACHE = 'kobo-ledger-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // GitHub API, fonts etc. are never cached here

  // The app page: always try the internet first so updates show straight away,
  // and fall back to the saved copy when offline.
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Icons and the manifest: use the saved copy, refresh it in the background.
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => { caches.open(CACHE).then(c => c.put(req, res.clone())); return res; }).catch(() => hit);
      return hit || net;
    })
  );
});
