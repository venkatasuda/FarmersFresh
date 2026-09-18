# Farmers Fresh

Livestock & meat management system for a multi-farm, multi-store operation.
Built to last: multi-tenant from day one, PostgreSQL core, immutable event log, AI-ready.

**Stack:** Next.js 16 (App Router, TypeScript strict) · Supabase (PostgreSQL, Auth, RLS) · Vercel · PWA
**Domain:** farmersfresh.store

---

## Launch and CI status

This project now has blocking release checks. See [Production CI](docs/engineering/PRODUCTION-CI.md), [Architecture](docs/engineering/ARCHITECTURE.md) and [Validation](docs/engineering/VALIDATION.md). The current code has failing regression/lint/audit checks; it is not validated for launch. No automatic deployment job is included.

## Getting started

### 1. Install dependencies

```bash
npm ci
```

### 2. Set up Supabase

- For isolated local testing, use Docker and the pinned Supabase CLI; follow the [CI guide](docs/engineering/PRODUCTION-CI.md).
- The application depends on many migrations and RPCs. Running only migrations 0001/0002 is insufficient for the current storefront.
- The historical chain must be repaired or intentionally re-baselined and verified from an empty database before production setup. The supplied schema snapshot supports a separate recovery-test route; it does not repair migration history.
- Copy `.env.example` to `.env.local` for development and set the project's URL and public key. Never use production credentials in automated tests.

### 3. Run

```bash
npm run dev
```

Open http://localhost:3000 for the public storefront; staff sign in at `/login`.

### 4. Before every push

```bash
npm run build
```

Catches type errors locally in ~45 seconds instead of on a failed Vercel deploy.

---

## Who signs in, and how

Two tiers, deliberately different:

| Tier | Who | How they identify | What they can do |
| --- | --- | --- | --- |
| **Account** | Owner, managers, accountants, office staff | Email + password (Supabase Auth) | Full session, RLS scoped to their org + locations |
| **Card** | Production / floor / counter staff | RFID card tapped on a trusted station | Attributed actions only (clock-in, record sale) — no account, no browser session |

**Why cards are not logins.** An RFID card UID is a plain number printed on the air —
it can be read and cloned by anyone with a £5 reader. It is an *identifier*, not a
*credential*. So a card never opens a session on its own. Instead the shop's shared
device signs in once as a **station account**, and staff tap their card to attribute
work to themselves. The station is the thing that's trusted; the card just says who.

Office staff, who move money and change records, get a real password.

---

## How we build (bit by bit)

Each bit is a small, working commit — ship it, use it, then the next.

- **Bit 1 — Scaffold** ✅: Next.js + Supabase wiring, Phase-1 schema, event-log helper.
- **Bit 2 — Auth** ✅: login page, `proxy.ts` session refresh, profile + memberships, protected routes, staff-card schema.
- **Bit 3 — Record a Sale (POS)**: customer/anonymous, line items (cut → weight → price), take payment or mark credit; writes a `sale.created` event.
- **Bit 4 — Credit Ledger**: `customer_balances` list ("who owes me most"), customer detail, record a payment.
- **Bit 5 — Customers**: add/edit customers.
- **Bit 6 — Stock (basic)**: current stock per cut, adjust, mark wasted.
- **Bit 7 — Dashboard**: today's sales, collected vs credit, outstanding, expiring stock.
- **Bit 8 — PWA polish**: manifest + service worker (installable, offline-first).
- **Bit 9 — Card tap**: station mode, RFID reader input, clock-in/clock-out.

Then **Phase 2**: the living/breeding core (flock, heat & pregnancy, health + withdrawal
guard, slaughter), with meat flowing farm → store on the same location model.

---

## Project structure

```
/app
  /login              email + password sign in
  /(app)              protected routes — layout enforces a session
    /dashboard        who am I, my org, my role, my locations
  /auth/signout       sign-out route handler
/lib
  /supabase           client + server + proxy Supabase helpers
  events.ts           single helper to append to the immutable event log
/supabase/migrations
proxy.ts              session refresh + route protection (Next.js 16)
```

## Conventions

- Every action that changes money or records also appends to `events` — the audit
  trail and the future-AI dataset. Use `logEvent()` everywhere.
- Security is enforced by the database (RLS), not just the UI.
- Money: `numeric(12,2)`. Weight: `numeric(12,3)`.
- **Next.js 16**: `middleware.ts` is now `proxy.ts`; `cookies()`, `params` and
  `searchParams` are all async. See `AGENTS.md`.
