/**
 * Waterline service worker.
 *
 * Navigations are network-first so a deploy reaches you on the next load.
 * Everything else is stale-while-revalidate: instant from cache, refreshed
 * in the background. Firebase's own traffic is never touched — Firestore has
 * its own offline persistence and caching its API would corrupt sync.
 */
const VERSION = "waterline-v33";
const SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/store.js",
  "./js/stages.js",
  "./js/i18n.js",
  "./js/config.js",
  "./manifest.webmanifest",
  // Every icon belongs here. They are cached like any other asset, so one
  // left out keeps serving last version's artwork until its own entry
  // happens to be evicted — which is how a redrawn favicon stays stale.
  "./favicon.svg",
  "./favicon.ico",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

/** Hosts that must always go straight to the network. */
const BYPASS = [
  "firestore.googleapis.com",
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
  "firebaseinstallations.googleapis.com",
  "apis.google.com",
  "accounts.google.com"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION)
      // cache: "reload" bypasses the browser's own HTTP cache. Without it a
      // still-fresh max-age can hand us the very bytes this version exists to
      // replace, and the new cache is seeded with the old asset.
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (BYPASS.some((host) => url.hostname.endsWith(host))) return;

  // Navigations: fresh if we can, cached shell if we can't.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html").then((hit) => hit ?? Response.error()))
    );
    return;
  }

  /*
   * Our own code is network-first too, for the same reason navigations are.
   * index.html always arrives fresh, so serving last version's CSS or modules
   * beside it pairs new markup with old styles and old translations — and with
   * no build step there are no hashed filenames to force a cache miss. Offline
   * still falls back to the cache, so the app opens with no connection.
   */
  if (url.origin === location.origin && /\.(?:js|css)$/.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit ?? Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok && (url.origin === location.origin || response.type === "cors")) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached ?? network;
    })
  );
});
