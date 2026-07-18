<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Farmers Fresh — project rules

## Next.js 16 gotchas already hit

- `middleware.ts` is now **`proxy.ts`**, exporting a function named `proxy`.
- `cookies()`, `params`, `searchParams` are all **async** — always `await`.
- `next lint` is removed; run `eslint` directly.
- `next dev` builds to `.next/dev`, `next build` to `.next` — they can run at once.

## Brand: green and white, always

Full rules in `docs/BRAND.md`. In short:

- Palette tokens live in `app/globals.css` under `@theme`. Use `brand-600`,
  `surface`, `canvas`, `line`, `ink`, `ink-soft` — **never raw hex** in a component.
- Green is for identity, primary actions, and good news. Not for everything.
- Light theme only. No `dark:` variants.
- Icons: `lucide-react`, vector only, never raster sprites.
- Images: `next/image` only. Own photos > Unsplash/Pexels. Never scrape a
  competitor's assets — this is a food business, and that is a real legal risk.

## Non-negotiables

- Every action that touches money or records calls `logEvent()` — the `events`
  table is append-only and enforced by a database trigger.
- Security is enforced by **RLS**, not the UI. If a page needs to hide data,
  the policy should already make it invisible.
- RFID cards **identify**, they do not **authenticate**. A card UID is clonable.
  Trust lives in the signed-in station, never in the card. See `0002_staff_cards.sql`.
- Run `npm run build` before every push. Type errors caught locally take 45
  seconds; caught on Vercel they take a failed deploy.
