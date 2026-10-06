# Backend Architecture — the master data model (so we never restructure)

*Purpose: lock down the core primitives now, so every roadmap phase attaches by ADDING a column or a table that references an existing key — never by reshaping the core. This is the "think about all the backend up front" contract.*

## The five core primitives (everything hangs off these)

1. **`organizations` / `locations`** — the tenant + its physical places (farm, store, future dark stores). Every stock-bearing row already carries `location_id`, so **multi-location is already in the schema** — Phase 3 is switching UI to show more than one, not a migration.

2. **`products`** — the catalogue item. Carries `last_cost` (landed cost) → feeds margins and forecasting.

3. **`stock_movements`** — the append-only ledger. **On-hand is always `sum(delta)`** — never a mutable quantity cell. Every inflow/outflow in the whole system is one immutable row here (reason + who + ref). This is the single source of truth for inventory. It now also carries `batch_id` (the hook below).

4. **`product_batches`** — a dated **lot** of one product: its source (purchase / production / opening / return / traceability), supplier, farm, landed cost, **expiry date**, and a live `remaining_qty`. This one row is shared by *recall traceability AND fresh rotation* — one batch concept, not two. Kept in sync by the `trg_stock_batch` trigger, which FEFO-depletes oldest-expiry-first on every ledger write **without any sale/POS/order code knowing it exists**.

5. **`purchase_orders` / `purchase_order_items` / `suppliers`** — procurement. Receiving a PO writes a `product_batches` lot + a `stock_movements` row, so cost and expiry enter the system at goods-in.

Invariant maintained across all of the above: for a product at a location, **`sum(active batch.remaining_qty)` tracks ledger on-hand** (seeded from opening balances, kept true by the trigger).

## How every remaining roadmap phase attaches — additively

| Phase / feature | How it attaches | Restructure? |
|---|---|---|
| **FEFO / expiry** (Phase 1 — done) | `product_batches.expiry_date` + trigger + `expiring_batches()` | No |
| **Auto-markdown of short-dated stock** | new `markdowns` table → `batch_id` FK; a clearance price per lot | No — references batch |
| **Cold-chain / temperature log** | new `temperature_readings` table → `batch_id` (or `location_id`) FK | No — references batch |
| **Production / cutting plan** (meat) | new `production_orders` → writes a `stock_movements` row (reason `production`) which the trigger already turns into a batch | No — reuses ledger + trigger |
| **Exact COGS per sale** | stamp `batch_id` on sale movements (optional strict mode); cost = that batch's `unit_cost` | No — column already exists |
| **Multi-location + transfers** | `location_id` already on every row; add a `transfers` table writing two ledger rows (`transfer_out`/`transfer_in`) | No — location already modelled |
| **Order routing** | choose a `location_id` at order time; OMS already location-aware | No |
| **Auto rider allocation / batching** | new `delivery_batches` table → `order_id` FKs; deliveries already have rider + geo | No |
| **Supplier scorecards** | aggregate existing `purchase_orders` (fill rate, lead time) — read-only views | No new core |
| **Your own demand model** | already seam-ready: `FORECAST_PROVIDER=custom` + `demand_series()` training data | No |
| **Finance depth (GST, AP, P&L)** | read-model views over `orders`, `order_items`, `purchase_orders`, `wastage_log`, batch cost | No new core |
| **Workforce / rostering / rider payouts** | new tables keyed by `profiles` / rider id + `locations` | Isolated, no core change |
| **Loss prevention / shrink** | variance = ledger on-hand vs counted; `stock_count` movements already exist | No |

## The rules that keep it clean

- **Never store a mutable stock quantity.** Stock changes are ledger rows; on-hand is a sum. (Corrections = an opposing row, never an edit.)
- **Every physical thing is a batch.** Cost, expiry, farm, recall and rotation all live on the lot, so new fresh/quality features add a column there.
- **New outflow/inflow reasons reuse `stock_movements` + the trigger.** Production, transfers, returns already flow through it — the batch bookkeeping is automatic.
- **Sensitive/config numbers live on `organizations`** (delivery fee, max discount, subscription %, and future: safety-stock %, markdown %). One row to tune the business.
- **Writes go through `SECURITY DEFINER` RPCs; tables are read-only under RLS.** New features add RPCs, not table grants.

Net effect: Phases 1–4 in the roadmap are **feature work on a fixed foundation**, not schema re-architecture.
