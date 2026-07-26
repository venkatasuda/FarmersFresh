/* Farmers Fresh service worker.
 *
 * Deliberately conservative: a NETWORK-FIRST strategy for navigations, falling
 * back to a cached shell only when the network fails. This means the app is
 * installable and survives a dropped connection, but never serves a stale
 * page or, worse, a stale PRICE when the network is fine. For a shop, showing
 * an old price would be a real problem — so freshness wins over aggressive
 * caching.
 */

const CACHE = "ff-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([OFFLINE_URL, "/icon.svg"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET navigations; let everything else (POST, API, Supabase)
  // go straight to the network untouched. Never cache mutations or data.
  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Keep a copy of the last good page for offline fallback.
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || caches.match(OFFLINE_URL);
        })
    );
  }
});
