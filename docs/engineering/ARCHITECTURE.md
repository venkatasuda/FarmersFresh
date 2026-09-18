# Application boundaries and structure

The existing stack is a valid full-stack Next.js application. Frontend pages, backend HTTP routes and Server Actions can share a repository. Supabase supplies authentication, database access, RLS and transactional RPCs. A separate Express/Nest service or microservices would add operational work without fixing the current authorization and concurrency defects.

The problem is responsibility placement: `lib/` contains formatting, authentication, catalogue queries, forecasting, orders, stock and financial operations; route folders combine forms, request parsing, data access and workflow logic; PostgreSQL holds another substantial business layer. Root layout also does storefront work for every area. Those boundaries make changes harder to review and test.

## Current examples

| Current location | Problem and effect |
| --- | --- |
| `app/layout.tsx` | Fetches shop settings and mounts cart, wishlist, drawer, toast and service worker for staff pages too |
| `app/(shop)/` | Primarily shared storefront components, while cart, checkout, account and pass routes live outside its layout boundary |
| `lib/` | Pure browser-safe helpers sit beside modules importing cookies and database clients; easy to accidentally drag server code into client modules |
| Razorpay API routes | Order and membership routes duplicate payment creation/persistence behavior; drift becomes likely when correcting retries or gateway validation |
| `app/(app)/dashboard/purchasing/actions.ts` | Multi-step application workflow spans separate RPC calls; moving files will not make purchase order creation transactional |
| `supabase/schema_snapshot.sql` plus historical migrations | Live schema and reproducible source history have different authority; recovery and canonical migration chains need one documented release process |
| Root `tsconfig.json` | Excludes Edge Functions, so successful app typecheck says nothing about notification-worker types; new CI now checks Deno separately |

## Recommended layout

Keep one application and add domain boundaries gradually. The table describes a target organization; this package does not move production routes.

| Directory | Responsibility and import rules |
| --- | --- |
| `app/(store)/` | Public shop, products, cart, checkout, pass and public content. Shop layout owns storefront providers/header/footer |
| `app/(store)/account/` | Account routes sharing the store shell; a nested authenticated account layout handles customer navigation |
| `app/(staff)/dashboard/` and staff/POS routes | Staff shell, role-aware navigation and staff authorization. Customer cart providers do not wrap this area |
| `app/api/` | HTTP request/response adapters: parse inputs, authenticate/authorize, call a server service, map errors; no independent pricing or stock algorithms |
| `features/orders/`, `features/payments/`, `features/inventory/`, `features/wallet/`, etc. | One domain per directory, with browser-safe `model.ts`/`schema.ts`, `client/` UI/hooks and `server/` services/repositories |
| `features/<domain>/server/` | Use cases and persistence/gateway adapters. Explicit `import "server-only"` marks server modules; no shared barrel that re-exports these into client code |
| `components/ui/` | Reusable presentation components with no database calls or financial rules |
| `lib/shared/` | Small pure utilities and common types. Browser-safe imports only; no cookies, environment secrets or Supabase server imports |
| `lib/server/` | Shared staff/customer authorization, validated environment, logging and backend infrastructure |
| `lib/supabase/` | Distinct browser, user-scoped server and service-role clients; service-role client inaccessible from browser code |
| `supabase/migrations/` | Complete, versioned schema/functions/RLS/constraints/triggers. SQL owns atomic money, inventory and reward mutations |
| `supabase/functions/` | Background worker entry points using a claimed outbox and explicit retry/idempotency rules |
| `tests/unit/`, `tests/api/`, `tests/database/`, `tests/e2e/` | Checks against the relevant boundary, with synthetic fixtures and independent connections for concurrency |

Route groups do not change public URLs. Moving `/checkout` into `(store)` can keep `/checkout`; moving files still needs import updates and regression checks. `src/` is optional and changing every path to it is not necessary for cleaner boundaries.

## Where business rules belong

A UI calculates an indicative total and collects input. Its Server Action or HTTP route parses and authorizes that request. A domain service coordinates the request and handles external gateway failures. A user-scoped database RPC enforces ownership, roles, prices, stock and allowed transitions within one transaction. RLS controls direct table access. Service-role payment functions are deliberately restricted and validate the gateway event before changing money state.

A TypeScript service must not split one atomic reservation or wallet debit across separate HTTP/database requests. Keep that in PostgreSQL; reorganizing folders alone will not repair it. Conversely, sending emails or charging external payment providers cannot be rolled back by PostgreSQL. Use persisted attempts/outbox records, stable idempotency keys and reconciliation.

Customer authentication and staff authorization remain distinct. Being signed in does not establish a staff profile, membership or capability. Hiding a dashboard page or adding an API check cannot compensate for a publicly executable SECURITY DEFINER function with missing authorization.

## Suggested refactor sequence

1. Resolve red tests and high-risk SQL authorization/money/inventory findings first. Preserve these regression tests during moves.
2. Build a single payment gateway/persistence service shared by order and membership entry points, with typed request/result contracts and additional timeout/outage tests.
3. Move cart, wishlist and PWA mounting into a store layout; put all routes that rely on those contexts beneath that group. Keep URLs stable and rerun checkout/cart/account tests.
4. Extract orders, inventory, wallet and procurement into domain directories. Keep route actions thin and database mutations atomic; do one domain at a time.
5. Generate Supabase types from the verified canonical schema, then introduce shared runtime schemas for API/action inputs. Test malformed JSON and untrusted numeric fields.
6. Enforce imports with the existing boundary check and extend it when new folders are introduced. Add per-domain tests and capability-matrix database tests as part of each extraction.

Keep server-only dependency imports explicit and type-only browser imports explicit. Next's 'use server' action modules may intentionally be imported by Client Components as action proxies; ordinary server services may not. The current checker accounts for that distinction.

The goal is a modular application with reliable transactions and consistent authorization. More folders alone do not establish production readiness.
