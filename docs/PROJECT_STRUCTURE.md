# Proposed Project Structure

*Read this first: this is Next.js 16 App Router. Server and client code co-locate
by design — there is no "frontend folder / backend folder" split, and forcing one
fights the framework. The separation that actually matters (and that already broke
your build once, per AGENTS.md) is the **client-safe vs server-only import
boundary**. This structure makes that boundary physical: a folder you're allowed to
import from a Client Component, and a folder you're not.*

*Do NOT big-bang migrate. Moving ~130 files at once, with no green build to verify
against, trades a tidy tree for a week of broken imports. Migrate a slice at a time,
running `npm run build` between slices. Priority order is at the bottom.*

## Target tree

```
farmers-fresh/
├─ app/                         # ROUTES ONLY — thin: page/layout/loading/error
│  ├─ (shop)/                   # customer storefront (route group)
│  │  ├─ layout.tsx
│  │  ├─ page.tsx               # home
│  │  ├─ shop/[slug]/page.tsx
│  │  ├─ cart/  checkout/  account/  offers/  recipes/ ...
│  │  └─ ...                    # ← only route files live here now
│  ├─ (dashboard)/              # back office (rename of today's "(app)")
│  │  └─ dashboard/
│  │     ├─ layout.tsx
│  │     └─ <feature>/page.tsx  # thin: imports from features/<feature>
│  ├─ api/                      # route handlers (visual-search, webhooks…)
│  ├─ layout.tsx
│  └─ globals.css
│
├─ components/                  # REUSABLE UI — presentational, CLIENT-SAFE
│  ├─ ui/                       # primitives: Card, Button, Kpi, Skeleton, Stars
│  ├─ shop/                     # ProductCard, SearchBox, CartDrawer, BottomNav…
│  └─ dashboard/                # shared back-office widgets
│     └─ (no next/headers, no supabase/server — ever)
│
├─ features/                    # FEATURE MODULES (back office) — colocated
│  ├─ purchasing/  { actions.ts, purchasing-client.tsx, types.ts }
│  ├─ wastage/  expiry/  coldchain/  financials/  reorder/  production/ ...
│  │  (today's app/(app)/dashboard/<x>/{actions,client} move here;
│  │   the route page.tsx stays in app/ and just imports the module)
│
├─ lib/
│  ├─ db/                       # SERVER-ONLY data access — the "backend"
│  │  ├─ supabase.ts            # server client (imports next/headers)
│  │  ├─ shop.ts  orders.ts  stock.ts  settings.ts  forecast.ts
│  │  └─ (the ONLY place allowed to touch the database)
│  ├─ domain/                   # PURE logic, no I/O: cuisines, grocery-terms, qr
│  ├─ format.ts                 # CLIENT-SAFE (pure) — importable anywhere
│  ├─ types.ts                  # CLIENT-SAFE — importable anywhere
│  ├─ auth.ts  guard.ts         # server-only helpers
│
├─ supabase/
│  ├─ migrations/               # numbered SQL (unchanged)
│  └─ functions/                # edge functions (unchanged)
│
├─ docs/   public/   AGENTS.md
```

## The rules that make it professional (and prevent the old build break)

1. **`app/` holds routes, not logic.** A `page.tsx` fetches via `lib/db/*` and renders
   a component from `components/*` or `features/*`. If a route file is >~40 lines of
   JSX, its body belongs in a component.
2. **`components/` and `lib/format.ts` + `lib/types.ts` are client-safe.** They must
   never import `next/headers` or `lib/db/*`. This is the one boundary that broke the
   build before; now it's a folder rule you can eyeball in a review.
3. **`lib/db/` is the only door to the database.** All Supabase server access lives
   here. This *is* your "backend" — you don't need a separate repo or folder tree.
4. **`features/<name>/` colocates a back-office feature** (server actions + client
   component + local types). You already do this inside `app/(app)/dashboard/*`; this
   just lifts it out of the routing folder so `app/` stays thin.
5. **Server actions stay `"use server"` files that export only async functions.**
   Constants/types for a feature go in a sibling non-server file (the exact bug that
   just hit `wastage/actions.ts`).

## Why not a separate frontend/backend

In Next.js the server *is* the app: server components render on the server, server
actions and route handlers are your API, and the client bundle is derived from the
same tree. A separate backend adds a network hop, a second deploy, duplicated types,
and CORS — for a solo build that's pure overhead. The professional move is one Next
app with a hard **import boundary**, which the tree above enforces.

## Migration order (incremental, build-checked — never big-bang)

Do these as separate commits, `npm run build` after each:

1. **`components/ui/`** — move the new `dashboard/ui.tsx` primitives here; cheapest, zero risk.
2. **`components/shop/`** — move the flat `app/(shop)/*` components (ProductCard, SearchBox,
   CartDrawer, BottomNav, etc.) out of the route group. Update imports (find/replace the path).
3. **`lib/db/`** — move `shop.ts, orders.ts, stock.ts, settings.ts, forecast.ts` under `lib/db/`,
   leave `format.ts` + `types.ts` at `lib/` root (client-safe). Update imports.
4. **`features/`** — lift `app/(app)/dashboard/<x>/{actions,client}.tsx` into `features/<x>/`,
   keep the thin `page.tsx` in `app/`. One feature per commit.
5. Rename route group `(app)` → `(dashboard)` for clarity (last, since it touches many paths).

Each step is a mechanical move + import path update, verifiable by a green build. Stop
any time — a half-migrated tree still runs, because nothing here changes behaviour.
```
