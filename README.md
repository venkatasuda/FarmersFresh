<<<<<<< HEAD
# Farmers Fresh

Livestock & meat management system for a multi-farm, multi-store operation.
Built to last: multi-tenant from day one, PostgreSQL core, immutable event log, AI-ready.

**Stack:** Next.js (App Router, TypeScript strict) · Supabase (PostgreSQL, Auth, RLS) · Vercel · PWA
**Domain:** farmersfresh.store

---

## Getting started

### 1. Create the app base (known-good scaffold)
```bash
npx create-next-app@latest farmersfresh --typescript --app --eslint
cd farmersfresh
npm install @supabase/supabase-js @supabase/ssr
```

### 2. Drop in the project files
Copy the contents of this starter package into the project (keeping paths):
```
supabase/migrations/0001_init_phase1.sql
lib/supabase/client.ts
lib/supabase/server.ts
lib/events.ts
.env.example
```

### 3. Set up Supabase
- Create a Supabase project.
- SQL Editor → run `supabase/migrations/0001_init_phase1.sql`.
- Create your user in Authentication, then run the one-time bootstrap block
  (Section 11 of the migration) to make yourself owner of your first farm + store.
- Copy `.env.example` to `.env.local` and fill in your project URL + anon key.

### 4. Run
```bash
npm run dev
```

### 5. Create the GitHub repo and push
```bash
git init
git add .
git commit -m "commit 1: project scaffold, Supabase wiring, Phase-1 schema"
# create the repo on github.com (or: gh repo create farmersfresh --private --source=. --remote=origin)
git remote add origin git@github.com:<your-username>/farmersfresh.git
git branch -M main
git push -u origin main
```

---

## How we build (bit by bit)

Each bit is a small, working commit — ship it, use it, then the next.

- **Bit 1 — Scaffold** *(this package)*: Next.js + Supabase wiring, Phase-1 schema, event-log helper.
- **Bit 2 — Auth**: login page, session middleware, load profile + memberships, protected routes.
- **Bit 3 — Record a Sale (POS)**: customer/anonymous, line items (cut → weight → price), take payment or mark credit; writes a `sale.created` event.
- **Bit 4 — Credit Ledger**: `customer_balances` list ("who owes me most"), customer detail, record a payment.
- **Bit 5 — Customers**: add/edit customers.
- **Bit 6 — Stock (basic)**: current stock per cut, adjust, mark wasted.
- **Bit 7 — Dashboard**: today's sales, collected vs credit, outstanding, expiring stock.
- **Bit 8 — PWA polish**: manifest + service worker (installable, offline-first).

Then **Phase 2**: the living/breeding core (flock, heat & pregnancy, health + withdrawal guard, slaughter), with meat flowing farm → store on the same location model.

---

## Project structure (target)
```
/app            routes: /login, /sales, /ledger, /customers, /stock, /dashboard
/lib/supabase   client + server Supabase helpers
/lib/events.ts  single helper to append to the immutable event log
/components      POS form, customer picker, balance list, ...
/supabase/migrations
```

## Conventions
- Every action that changes money or records also appends to `events` — the audit
  trail and the future-AI dataset. Use `logEvent()` everywhere.
- Security is enforced by the database (RLS), not just the UI.
- Money: `numeric(12,2)`. Weight: `numeric(12,3)`.
=======
# FarmersFresh
>>>>>>> 17dec309ed9ec5225d0d0fce6c0bc0da34822942
