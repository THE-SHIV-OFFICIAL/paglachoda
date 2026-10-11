const CACHE_NAME = "moviebox-pwa-cache-v2";
const OFFLINE_URL = "/offline";

const ASSETS_TO_PRECACHE = [
  "/",
  OFFLINE_URL,
  "/icon.png",
  "/apple-icon.png",
  "/icon-192.png",
  "/icon-512.png",
];

const MAX_CACHE_ITEMS = 120;

const trimCache = (cacheName, maxItems) => {
  caches.open(cacheName).then((cache) => {
    cache.keys().then((keys) => {
      if (keys.length > maxItems) {
        cache.delete(keys[0]).then(() => trimCache(cacheName, maxItems));
      }
    });
  });
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          ASSETS_TO_PRECACHE.map((url) =>
            cache.add(url).catch((error) => {
              console.warn(`[PWA] Failed to cache ${url}`, error);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (!url.protocol.startsWith("http")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response?.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response.clone());
              trimCache(CACHE_NAME, MAX_CACHE_ITEMS);
            });
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(
            (cachedResponse) => cachedResponse || caches.match(OFFLINE_URL)
          )
        )
    );
    return;
  }

  if (
    isSameOrigin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/static/") ||
      url.pathname.match(/\.(js|css|png|jpg|jpeg|webp|gif|svg|ico|woff2|woff|ttf)$/))
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse?.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse);
                  trimCache(CACHE_NAME, MAX_CACHE_ITEMS);
                });
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (networkResponse?.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
              trimCache(CACHE_NAME, MAX_CACHE_ITEMS);
            });
          }
          return networkResponse;
        });
      })
    );
  }
});