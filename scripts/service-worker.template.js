/* global __PRECACHE__ */
const CACHE_NAME = "__CACHE_NAME__";
const PREFIX = "slowday-shell-";
const PRECACHE = __PRECACHE__; // replaced during web build
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await Promise.all(PRECACHE.map(async (url) => {
      const response = await fetch(new Request(url, { cache: 'reload' }));
      if (!response.ok || response.redirected) throw new Error('App shell unavailable');
      await cache.put(url, response);
    }));
  }));
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;
  // Only cache this build's own app shell. Do not intercept authentication or APIs.
  if (
    event.request.mode === "navigate" &&
    ["/", "/index.html", "/privacy", "/privacy/"].includes(url.pathname)
  ) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.open(CACHE_NAME).then((cache) => cache.match("/index.html")),
      ),
    );
  } else if (PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches
        .open(CACHE_NAME)
        .then((cache) => cache.match(url.pathname))
        .then((cached) => cached || fetch(event.request)),
    );
  }
});
