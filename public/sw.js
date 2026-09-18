/* Farmers Fresh service worker.
 * Navigations always use the network. Offline mode shows a generic page;
 * personalised SSR HTML and prices never enter the service-worker cache.
 */

// Bump on any caching-logic change so `activate` purges the old cache — this
// also evicts any private page a previous version may have stored.
const CACHE = "ff-v3";
const OFFLINE_URL = "/offline";

// Never cache authenticated / sensitive / data routes. On a shared POS or
// tablet, a cached dashboard/account/receipt page must not survive logout.
const PRIVATE = /^\/(dashboard|staff|admin|pos|account|checkout|login|auth|api|track|receipt|order-placed|wishlist)(\/|$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([OFFLINE_URL, "/icon.svg"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith("ff-") && key !== CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// ---- Web Push -----------------------------------------------------------
// A push arrives as an encrypted JSON payload { title, body, url }. Show it as
// a notification; tapping it focuses an open tab or opens the target URL.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
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
  if (req.method !== "GET" || req.mode !== "navigate") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin || PRIVATE.test(url.pathname)) return;

  event.respondWith(
    fetch(req, { cache: "no-store" }).catch(async () => {
      // Match only the generic offline page in this worker's current cache.
      // Never fall back to HTML cached for a previous account or URL.
      const cache = await caches.open(CACHE);
      const offline = await cache.match(OFFLINE_URL);
      return offline || new Response("You are offline. Please reconnect and try again.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    })
  );
});
