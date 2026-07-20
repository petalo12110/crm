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
  // fetch() cannot be called on a navigation-mode request (loading a page
  // directly, e.g. /admin) — the Fetch spec forbids it and throws
  // "TypeError: Failed to fetch". Let the browser handle those normally.
  if (event.request.mode === 'navigate') return

  // No reason to intercept cross-origin calls (e.g. our own API on a
  // different domain) — we do no caching, so just let those go straight
  // through untouched rather than re-wrapping them for no benefit.
  if (new URL(event.request.url).origin !== self.location.origin) return

  event.respondWith(fetch(event.request))
})
