// Deliberately minimal — this exists mainly so Chrome treats the app as
// installable (a fetch handler is part of the installability criteria).
// No caching strategy on purpose: this is for live testing against a real
// backend, and stale cached responses would be actively confusing during
// that. A real "offline-capable" service worker is a separate, later
// piece of work.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request))
})
