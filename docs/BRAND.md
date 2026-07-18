# Farmers Fresh — brand & UI rules

## Palette: green + white

Green is the brand. White and warm grey carry the data. **Green is used
sparingly** — identity, primary actions, and positive money. If every panel is
green, green stops meaning anything.

Defined in `app/globals.css` under `@theme`. Use the Tailwind utilities, never
raw hex in components.

| Token | Use |
| --- | --- |
| `brand-600` `#16a34a` | Primary buttons, logo, active nav, key numbers |
| `brand-700` `#15803d` | Hover on primary |
| `brand-50` / `brand-100` | Section headers, badges, subtle fills |
| `brand-900` | Text on a brand-50 background |
| `surface` `#ffffff` | Cards, panels, inputs |
| `canvas` `#f6faf7` | Page background (a whisper of green) |
| `line` `#e3ebe6` | Borders, dividers |
| `ink` `#14231a` | Primary text |
| `ink-soft` `#5c6b62` | Secondary text, labels |

**Light theme only.** This runs on a counter under bright shop lights and on
phones in a farmyard in daylight. Dark mode is the wrong tool here, and two
palettes drift apart.

### Colours that are not brand

Money and safety need their own meaning, and must not be green-on-green:

- **Red** — outstanding credit, expired stock, withdrawal-period violations.
- **Amber** — expiring soon, partial payment.
- **Green** — paid, in stock, safe to sell.

## Icons

Use [`lucide-react`](https://lucide.dev) (MIT licence). Install:

```bash
npm install lucide-react
```

Icons are **vector**, so they are sharp on every screen at every zoom, cost
about 1 KB each, and work offline — all of which matter more here than any
"ultra HD" raster icon set would. Never ship PNG icon sprites.

```tsx
import { ShoppingCart, Wallet, Beef } from "lucide-react";

<ShoppingCart className="size-5 text-brand-600" />;
```

Size with `size-4` (inline), `size-5` (buttons), `size-6` (nav). Always pair a
lone icon button with `aria-label`.

## Photography

Taking visual inspiration from a polished grocery app is fine. Copying its
assets is not — their product photography, icons, and illustrations are
owned work, and a food business is an easy target for a rights claim.

**Where images may come from:**

1. **Your own photos.** Best answer by a distance. Real photos of your cuts, on
   your trays, build more trust with a customer than any stock library. Store
   them in Supabase Storage → public bucket → serve via `next/image`.
2. **Unsplash / Pexels** — free for commercial use, no attribution required.
   Good enough as placeholders while building.
3. **Never** — Google Images, a competitor's site, or anything without a
   licence you can name.

Allowed hosts are configured in `next.config.ts` under `images.remotePatterns`.
Anything not listed there is blocked by Next.js on purpose.

**Always use `next/image`**, never a bare `<img>`. It resizes, converts to
WebP/AVIF, and lazy-loads. A 4 MB "ultra HD" JPEG dropped into an `<img>` tag
will make the POS unusable on a 3G connection in a village — which is exactly
where this app has to work.

```tsx
import Image from "next/image";

<Image
  src={product.imageUrl}
  alt={`${product.name} — fresh cut`}
  width={400}
  height={300}
  quality={90}
  className="rounded-xl object-cover"
/>;
```

### Where images belong (and don't)

- **Yes:** product/cut cards, a customer-facing catalogue, marketing pages.
- **No:** the POS sale screen. Staff serving a queue need big tap targets and
  fast numbers, not photographs. Speed is the feature there.
