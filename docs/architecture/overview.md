# Farmers Fresh architecture

Farmers Fresh is a modular full-stack application: Next.js supplies routes and
rendering; Supabase supplies authentication, PostgreSQL transactions and RLS.
Website, staff tools and future mobile clients share the database's business rules.

## Where code belongs

```text
src/
  app/
    (storefront)/     Customer routes, shared storefront layout and loading UI
    (dashboard)/     Staff routes and authenticated staff layout
    (auth)/login/    Staff sign-in page
    api/             HTTP entry points
    auth/            Authentication callback and sign-out routes
    receipt/         Printable receipt, outside storefront chrome
    offline/         Standalone offline fallback
    layout.tsx       HTML, fonts and global metadata only
  features/
    shop/ cart/ checkout/ account/ ...   Domain views and browser state
    dashboard/<area>/                  Staff views and action adapters
  server/
    auth/ catalogue/ customers/ delivery/ inventory/
    loyalty/ orders/ payments/ procurement/ reporting/
    settings/ subscriptions/ supabase/
  lib/
    contracts/       Browser-safe input/output types and receipt mapping
    supabase/client.ts
    format.ts types.ts guard.ts search.ts ...
  components/        Shared UI and brand primitives
supabase/
  migrations/        Schema, database functions, RLS and immutable audit events
  functions/         Background notification worker
tests/
  unit/ api/ database/ e2e/
scripts/
  ci/ db/
docs/
  architecture/      Overview, boundaries and recorded decisions
  operations/        Deployment, payment setup, monitoring, PWA and CI guides
```

Route groups do not change URLs. There is one root layout. Storefront providers
and chrome mount once in the storefront group; staff, receipt and offline pages
do not depend on basket or wishlist state. Large page views live in their feature
folders; route files retain metadata, route parameters, authorization and loading.

Server Action modules keep explicit async exports in `features/` and delegate to
server modules. Their implementations retain the existing validation, error
mapping and cache invalidation. Page reads call backend modules directly.
Payment and visual-search HTTP adapters live in server domain modules; API routes
retain method exports and runtime settings. The service-role client is centralized
in `server/supabase/admin.ts` and only used by payment adapters.

## Request flow

```text
Page             -> server query -> user-scoped database/RLS
Client component -> feature action -> server operation -> database RPC
HTTP route       -> server HTTP adapter -> gateway/database RPC
Worker           -> claimed notification outbox -> provider
```

Money, stock, order transitions and multi-step business rules belong in database
transactions. Server modules adapt requests and integrations; they do not replace
RLS with UI checks. Existing database migrations were not modified by this
reorganization. In particular, reorganizing procurement does not make its existing
multi-RPC create operation atomic; transaction fixes need separate migrations and
database regression tests.

Read [boundaries](boundaries.md) for import rules and
[ADR-0001](decisions/0001-modular-full-stack.md) for the decision.

## Validation

Run `npm run lint`, `npm run typecheck`, `npm run ci:boundaries`, `npm test` and
`npm run build`. Browser checks use the production server and a disposable local
database; database tests verify RLS and concurrency. The architecture unit check
preserves the 52 existing page URLs and checks that storefront state stays out of
the root layout. The browser architecture check exercises basket navigation and
the separate staff shell.
