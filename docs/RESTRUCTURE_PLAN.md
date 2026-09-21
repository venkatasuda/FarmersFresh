# Folder restructure plan

A file-by-file plan to move from the current flat `app/` + `lib/` layout to a
`src/`-based structure with clear server / client / types boundaries. **No files
are moved by this document.** Execute it only once the build works locally
(`npm run typecheck` + `npm run build`) and CI is green, so each phase is
validated. Do it in the phases below, committing after each green build — never
in one giant move.

## The one hard constraint

This is a **Next.js App Router** app. Route files — `page.tsx`, `layout.tsx`,
`route.ts`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `sitemap.ts`,
`robots.ts`, `manifest.ts`, `opengraph-image.tsx` — and their route-group folders
(`(shop)`, `(app)`) **must stay in the `app/` tree**. They cannot move into
`features/`. So "restructure" here means:

1. Move the whole `app/` tree under `src/app/` (Next supports this natively).
2. Split `lib/` — which currently mixes server-only data access, client-safe
   utilities, and shared types — into `src/server/`, `src/lib/`, `src/types/`.
3. (Optional) Lift the non-route UI and actions that are co-located inside route
   folders into `src/features/<domain>/`. This is optional; Next co-location is
   idiomatic and fine to keep.

## Target structure

```
src/
  app/          # Next routes ONLY (+ co-located route UI, unless lifted to features/)
  server/       # server-only: data access + mutations that import supabase/server or next/headers
    supabase/   # server.ts, proxy.ts
  lib/          # client-safe pure utilities (no supabase/server, no next/headers)
    supabase/   # client.ts
  types/        # shared types
  features/     # OPTIONAL: domain UI/actions lifted out of route folders
```

## `lib/` → new home (verified by import scan)

Server-only (import `@/lib/supabase/server` and/or `next/headers`) → **`src/server/`**:

| File | Notes |
|------|-------|
| `auth.ts`, `guard.ts` | session/role guards |
| `shop.ts`, `catalogue.ts`, `orders.ts`, `pos.ts`, `stock.ts`, `credit.ts` | storefront + POS data access |
| `deliveries.ts`, `forecast.ts`, `overview.ts`, `report.ts`, `analytics.ts` | ops/reporting reads |
| `banners.ts`, `settings.ts`, `events.ts` | admin/config reads & event log |
| `env.ts` | server env accessors |
| `supabase/server.ts`, `supabase/proxy.ts` | → `src/server/supabase/` |

Client-safe / pure (no server imports) → **`src/lib/`**:

| File | Notes |
|------|-------|
| `format.ts` | pure formatters (the `next/headers` match is only in its comment) |
| `search.ts` | fuzzy search |
| `qr.ts` | QR helper |
| `cuisines.ts`, `grocery-terms.ts` | static lookup data |
| `supabase/client.ts` | → `src/lib/supabase/` (browser client) |

Shared types → **`src/types/`**:

| File | Notes |
|------|-------|
| `types.ts` | → `src/types/index.ts` (or split by domain: catalogue, orders, stock) |

> Before moving any file, re-run the scan to confirm its side of the boundary:
> `rg -l "supabase/server|next/headers" lib` (a match in a *comment* doesn't count —
> `format.ts` is the one such false positive). `scripts/ci/check-boundaries.mjs`
> already encodes the rule and will fail CI if a client-safe file ends up importing
> a server module, so it is your safety net during the split.

## Import alias

`tsconfig.json` currently maps `@/*` to the repo root. After moving into `src/`:

```jsonc
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"] } } }
```

With this, Phase 1 (moving `app/` and `lib/` under `src/`) needs **zero import
edits** — every `@/lib/...` / `@/app/...` still resolves. The specifier changes
only happen in Phase 2, when `lib/` is split.

Also update: `vitest.config.mts` and `vitest.database.config.mts` (the `@` alias →
`./src`), `scripts/ci/check-boundaries.mjs` (walk `src/app`, check `src/lib/*`),
and any `next.config.ts` / `tailwind` `content` globs that name `app/` or `lib/`.

## Phased execution (build-gated)

**Phase 1 — introduce `src/` (mechanical, no specifier changes).**
- `git mv app src/app` and `git mv lib src/lib`.
- Update `tsconfig` paths to `./src/*`; update the vitest configs' alias and the
  boundary script's walk root.
- `npm run typecheck && npm run build && npm test`. Commit.

**Phase 2 — split `lib/` into `server/` + `lib/` + `types/` (per-module).**
Do ONE module at a time so a break is a one-file blast radius:
- `git mv src/lib/shop.ts src/server/shop.ts`.
- Find every importer: `rg -l "@/lib/shop\b" src` and rewrite to `@/server/shop`.
- `npm run typecheck`. Commit. Repeat for the next module.
- Move `src/lib/supabase/server.ts` + `proxy.ts` → `src/server/supabase/`; update
  `@/lib/supabase/server` → `@/server/supabase/server` across importers.
- Move `types.ts` → `src/types/index.ts`; rewrite `@/lib/types` → `@/types`.
- After each module: `npm run typecheck`. After the batch: `npm run build && npm test`.

**Phase 3 — (optional) lift co-located route code into `features/`.**
Only if you want route folders to hold just route files. For a domain (e.g.
`account`), move its client components and `actions.ts` to
`src/features/account/`, leave `page.tsx` in `src/app/account/`, and repoint the
page's imports. Build after each domain. Skip this phase entirely if you prefer
Next co-location — nothing else depends on it.

## Rollback

Every phase is a commit. If a phase misbehaves, `git reset --hard HEAD~1`. Because
Phase 1 changes no specifiers, it is trivially reversible; Phase 2 is where care
matters, which is why it is per-module.

## Notes / watch-outs

- **Server Actions & directives**: files with `"use server"` / `"use client"`
  keep those directives after moving; a server action must still export only
  async functions.
- **Route-relative imports**: co-located files often import siblings with `./`.
  Those are unaffected by Phase 1/2 (they move together) but matter in Phase 3.
- **`public/` and `supabase/` do not move.** Only `app/` and `lib/` are in scope.
- **Parallel work seen in the tree**: `app/receipt/` currently contains both my
  `receipt-client.tsx` and a separate `receipt-view.tsx` / `receipt-gate.tsx` /
  `print-button.tsx` set, and `app/order-placed/` has extra `confetti.tsx` /
  `add-more.tsx` — these look like a second implementation added outside this
  session. Reconcile those duplicates BEFORE restructuring, so you don't move two
  competing versions of the same page.
```
