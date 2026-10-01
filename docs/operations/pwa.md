# Installable app (PWA)

Farmers Fresh is a Progressive Web App — customers and staff can install it to
their home screen and it opens like a native app, with offline resilience.

## What's in place

- **`app/manifest.ts`** — name, colours, standalone display, icon.
- **`public/sw.js`** — a service worker with a **network-first** strategy: pages
  come fresh from the network, and only fall back to a cached copy (or the
  `/offline` page) when there's no connection. Freshness wins over caching on
  purpose — a shop must never show a stale price.
- **`app/(shop)/sw-register.tsx`** — registers the worker after load.
- **`app/offline/page.tsx`** — the friendly offline fallback.
- Theme colour + Apple web-app tags in the root layout.

## To finish for a full Android install prompt

Chrome wants raster icons at two sizes before it shows the "Install app"
prompt. The SVG works for iOS add-to-home, theme colour, and as a general
icon, but for Android:

1. Export the logo (`public/icon.svg`) as PNG at **192×192** and **512×512** —
   any tool, or open the SVG in a browser and screenshot at size.
2. Save them as `public/icon-192.png` and `public/icon-512.png`.
3. Add them to the `icons` array in `app/manifest.ts`:

   ```ts
   { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
   { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
   ```

That's the only manual step — everything else is wired.

## Push notifications (future)

Web push (alerting staff of a new order with the tab closed, or nudging a
customer) needs VAPID keys and a subscription store. It's a separate build on
top of this PWA foundation — the notification outbox (`notifications` table +
`send-notifications` worker) is the natural place to add a "web push" channel
alongside email/SMS/WhatsApp when you're ready.
