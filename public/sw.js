/* Farmers Fresh service worker.
 *
 * Deliberately conservative: a NETWORK-FIRST strategy for navigations, falling
 * back to a cached shell only when the network fails. This means the app is
 * installable and survives a dropped connection, but never serves a stale
 * page or, worse, a stale PRICE when the network is fine. For a shop, showing
 * an old price would be a real problem — so freshness wins over aggressive
 * caching.
 */

// Bump on any caching-logic change so `activate` purges the old cache — this
// also evicts any private page a previous version may have stored.
const CACHE = "ff-v2";
const OFFLINE_URL = "/offline";

// Never cache authenticated / sensitive / data routes. On a shared POS or
// tablet, a cached dashboard/account/receipt page must not survive logout.
const PRIVATE = /^\/(dashboard|account|checkout|login|auth|api|track|receipt|order-placed|wishlist)(\/|$)/;

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

// ---- Web Push -----------------------------------------------------------
// A push arrives as an encrypted JSON payload { title, body, url }. Show it as
// a notification; tapping it focuses an open tab or opens the target URL.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Farmers Fresh";
  const options = {
    body: data.body || "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only public GET navigations are ever cached. Everything else (POST, API,
  // Supabase, cross-origin, and any protected page) goes to the network
  // untouched — not intercepted, so nothing sensitive is ever stored.
  if (req.method !== "GET" || req.mode !== "navigate") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin || PRIVATE.test(url.pathname)) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache only a clean, public, successful HTML page — never a redirect,
        // 401/403/404/5xx, or anything but a 200.
        if (res && res.ok && res.status === 200 && !res.redirected) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => (await caches.match(req)) || caches.match(OFFLINE_URL))
  );
});
