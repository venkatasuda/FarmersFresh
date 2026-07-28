# Company-Side Software: How Zepto, Blinkit, Instamart & the German Grocers Run Operations — and a Roadmap for Farmers Fresh

*Prepared July 2026. The customer-facing app is only the tip of the iceberg. Below it sits a stack of internal systems that decides whether the business makes money. This document breaks that stack down top to bottom, shows what the big players actually run, maps where Farmers Fresh already stands, and lays out a phased roadmap.*

---

## The big picture: two different playbooks

**Quick-commerce (Zepto, Blinkit, Swiggy Instamart)** — the whole company is a real-time logistics machine built around *dark stores* (micro-warehouses 1.5–4 km from customers). Their software obsession is: forecast demand per neighbourhood per hour, stock each dark store to match, pick in 2–3 minutes, dispatch a rider in ~1 minute. Last-mile delivery alone is 40–50% of their logistics cost, so their software fights for every second and every rupee there. They **build** their differentiating systems in-house (Zepto's WMS is called *Packman*; Blinkit runs its own AI forecasting/routing stack).

**German grocers (Lidl/Kaufland via Schwarz Group, Aldi)** — huge physical footprint, razor-thin discount margins, deep supply chains. Their software obsession is: buying power, assortment discipline, supply-chain efficiency, and loss prevention at massive scale. Schwarz Group runs *one of the largest SAP-Retail systems in the world*, makes **500 million AI-supported decisions per day**, and famously **dropped a €500M SAP project ("Elwis")** to build its own ERP on its own cloud (Stackit). The lesson: even giants conclude that at scale you build the core yourself.

Both playbooks share the same underlying layers. Here they are, top (strategy/planning) to bottom (execution/infrastructure).

---

## PART 1 — The operations stack, top to bottom

### 1. Merchandising & Category Management
**What it is:** deciding *what to sell, where, and how it's grouped* — assortment per store, planograms (shelf/slot layout), category roles, own-brand strategy.
**How the MNCs use it:** Zepto and Blinkit localise the SKU mix per dark store by neighbourhood demographics and demand — different stores literally carry different products. Blinkit runs ~90% first-party (own) inventory so it controls assortment tightly. German discounters win on a *deliberately small, disciplined* assortment with heavy own-brand share.
**Farmers Fresh today:** catalogue, categories, brands, badges. *Gap:* per-zone assortment, planogram/slotting, assortment analytics.

### 2. Demand Planning & Forecasting
**What it is:** predicting how much of each SKU will sell, per location, per time window.
**How the MNCs use it:** Zepto forecasts at **PIN-code level** using ARIMA, Prophet, Random Forest and LSTM models, fed real-time signals (weather, local events, time of day). Blinkit runs AI demand prediction as the first layer of its stack. Schwarz built an AI demand-planning solution to fix sourcing. This is the single highest-leverage system in the whole stack — everything downstream depends on it.
**Farmers Fresh today:** ✅ baseline forecast + reorder engine (trailing average, netted against on-hand and open POs) **with a pluggable seam for your own ML model.** This is a real head-start.

### 3. Procurement & Supplier Management
**What it is:** sourcing, supplier onboarding, contracts, purchase orders, goods-in, landed cost.
**How the MNCs use it:** buying power is the German grocers' core weapon; centralised procurement + supplier scorecards + auto-generated POs from the replenishment engine. Q-commerce buys first-party from brands directly.
**Farmers Fresh today:** ✅ suppliers, purchase orders (draft→ordered→received), goods-in that captures landed cost. *Gap:* supplier scorecards, contract pricing, multi-supplier price comparison, auto-PO generation from forecast (partly done via Reorder→draft PO).

### 4. Supply-Chain, Inventory & Replenishment
**What it is:** the brain that turns a forecast into *replenishment* — how much to move to each location and when, across a network (central warehouse → dark stores → shelf).
**How the MNCs use it:** automated replenishment to keep shelves full while minimising spoilage and carrying cost; allocation logic that pushes the right stock to the right store. Manhattan/Blue Yonder-class systems do this for big grocers; q-commerce builds it in-house.
**Farmers Fresh today:** ✅ append-only stock ledger, on-hand, reorder suggestions. *Gap:* multi-location transfers/allocation, auto-replenishment rules, safety-stock/service-level targets.

### 5. Warehouse / Dark-Store Management (WMS)
**What it is:** the physical execution system inside a store/warehouse — receiving, put-away, bin/slot locations, pick paths, packing, cycle counts, **FEFO** (First-Expired-First-Out), batch/lot & expiry tracking, cold-chain/temperature.
**How the MNCs use it:** Zepto's **Packman** assigns orders to associates, gives optimised picking routes, and enforces scan-on-pick/pack; it re-optimises store layout around fast movers. Fresh-food WMS enforces FEFO, flags short-dated stock, and tracks lot + temperature to cut spoilage.
**Farmers Fresh today:** ✅ stock ledger + wastage logging + internal traceability (recall). *Gap:* bin/slot locations, pick paths, **batch/expiry (FEFO) tracking**, cold-chain logging.

### 6. Order Management System (OMS)
**What it is:** the orchestrator that takes an order from any channel and coordinates payment, sourcing location, stock reservation, fulfilment and status.
**How the MNCs use it:** routes each order to the nearest dark store with stock, reserves inventory, sequences pick→pack→dispatch, and keeps one source of truth for order state across app, support and ops.
**Farmers Fresh today:** ✅ orders, reservations via ledger, statuses, prepaid/held flow, POS. Solid for single-location; *gap:* multi-location order routing.

### 7. Last-Mile / Delivery Management
**What it is:** rider assignment, batching, routing, live tracking, proof of delivery, delivery-cost analytics.
**How the MNCs use it:** rider assignment in ~**1 minute** via AI matching; batching multiple orders per trip; route optimisation; because last mile is 40–50% of logistics cost, this is heavily optimised. Instamart reuses Swiggy's food-delivery fleet & routing; Blinkit uses Zomato's rider pool.
**Farmers Fresh today:** ✅ delivery assignment, live rider map, ETA, ratings, tips. *Gap:* auto rider allocation, multi-order batching, route optimisation, delivery-cost analytics.

### 8. Pricing & Promotions Engine
**What it is:** price setting, margin guardrails, markdown/clearance for short-dated stock, promotions, personalised offers.
**How the MNCs use it:** dynamic and localised pricing; automated markdowns on expiring fresh stock to recover value instead of writing it off; promo engines. (This is where you've *deliberately chosen not to play the dark-pattern game* — your Honest Price stance is a differentiator, not a gap.)
**Farmers Fresh today:** ✅ prices, compare-at, coupons with margin guardrail, member pricing, subscribe & save, below-cost alerts (Financials). *Gap:* automated markdown for short-dated stock (pairs with FEFO), rules-based promo scheduling.

### 9. Point of Sale (physical channel)
**What it is:** the counter system — scanning, payment, receipts, cash management, offline resilience.
**Farmers Fresh today:** ✅ POS terminal, credit/khata ledger. In good shape.

### 10. Finance / ERP Core
**What it is:** the money system — general ledger, accounts payable/receivable, **COGS & margin**, GST/tax, cash reconciliation, P&L. This is the "ERP" the German grocers spend fortunes on (SAP, then their own).
**How the MNCs use it:** integrates every other system so revenue, cost and stock reconcile; feeds statutory reporting and daily cash control.
**Farmers Fresh today:** ✅ Financials (revenue, est. COGS from landed cost, gross margin, margin-by-product, payment reconciliation). *Gap:* GST/tax reports, accounts payable to suppliers, full P&L, accounting-package export (Tally/Zoho).

### 11. Workforce Management
**What it is:** rostering/shifts, attendance, labour scheduling to demand, payroll, and — for q-commerce — **gig rider management** (onboarding, payouts, performance).
**How the MNCs use it:** labour scheduled to forecasted demand curves (Logile-class systems); fresh-food *production planning* (how much to prep/cut today); rider fleet management.
**Farmers Fresh today:** basic staff roles/locations. *Gap:* shift rostering, attendance, rider payouts/performance, production/cutting plan for the meat side.

### 12. Analytics, BI & Data Platform
**What it is:** the data lake/warehouse + dashboards + the ML platform that powers decisions.
**How the MNCs use it:** Schwarz runs **500M AI-supported decisions/day** on its own cloud; q-commerce dashboards watch delivery performance, cancellations, rider efficiency, store utilisation in real time to guide expansion and stocking.
**Farmers Fresh today:** ✅ sales summary, demand insights, per-feature dashboards. *Gap:* a unified data layer + exec KPI dashboard; this is where *your ML strength compounds*.

### 13. Loss Prevention, Quality & Compliance
**What it is:** shrink/theft detection, food-safety & cold-chain compliance, recall traceability, audit trails.
**How the MNCs use it:** Schwarz applies AI to loss prevention among its 500M daily decisions; fresh operators enforce temperature logs and lot traceability for recalls.
**Farmers Fresh today:** ✅ internal farm→batch traceability (recall), append-only ledgers (audit), wastage log. *Gap:* cold-chain logging, shrink analytics, food-safety checklists.

### 14. Infrastructure, Cloud & MLOps
**What it is:** where it all runs — cloud, data pipelines, model serving/monitoring, security.
**How the MNCs use it:** Schwarz built its *own* cloud (Stackit) and is migrating all ERP onto it by Oct 2026 — sovereignty + control. Q-commerce runs real-time model serving for forecasting and dispatch.
**Farmers Fresh today:** ✅ Next.js + Supabase (Postgres, RLS, edge functions), pluggable model seams (vision, voice, forecast). *Gap:* a model-serving/monitoring setup when your own models go live.

---

## PART 2 — How they actually operate it (the daily loop)

The systems above aren't a list — they're a **closed loop** that runs every single day:

**Forecast** demand per SKU per location (Layer 2) → **allocate & replenish** stock (Layers 3–4) → **receive** goods at cost (Layer 3/5) → **store** with FEFO/expiry control (Layer 5) → **sell** across app/counter (Layers 6, 9) → **pick & pack** fast (Layer 5) → **dispatch & deliver** cheaply (Layer 7) → **log wastage & shrink** (Layers 5, 13) → **reconcile money & margin** (Layer 10) → **feed all of it back into the forecast** (Layers 2, 12).

The winners are the ones whose loop turns fastest and leaks least. Zepto's entire "10-minute" promise is really just *this loop, tightened*. The German grocers' margins come from *the same loop, disciplined at scale*.

---

## PART 3 — Build vs buy (what the giants actually chose)

- **Q-commerce: build the execution layers.** Zepto (Packman), Blinkit (AI stack) built forecasting, WMS and dispatch in-house because those *are* the product.
- **German grocers: even they build the core.** Lidl/Schwarz sank €500M into SAP, walked away, and are building their own ERP on their own cloud. At scale, the packaged system stops fitting.
- **Takeaway for Farmers Fresh:** you're already on the "build" path with full control of your data model. Build the *differentiating* layers (forecasting, fresh/FEFO, traceability, honest pricing); buy or defer the *commodity* layers (accounting package export, payroll) until scale justifies them.

---

## PART 4 — Where Farmers Fresh already stands

You are **further along than most early-stage grocery startups**, because the data foundation is right (an append-only ledger, captured landed cost, one honest cost figure). Rough coverage by layer:

| Layer | Status |
|---|---|
| 1 Merchandising / assortment | Partial (catalogue, no per-zone/planogram) |
| 2 Demand forecasting | ✅ Baseline + pluggable ML seam |
| 3 Procurement | ✅ Suppliers, POs, goods-in at cost |
| 4 Replenishment | ✅ Reorder engine (single location) |
| 5 WMS / fresh | Partial (ledger, wastage, traceability; no FEFO/bins) |
| 6 OMS | ✅ Single-location |
| 7 Last mile | ✅ Assign, live map, ETA (no auto-batch/route) |
| 8 Pricing & promo | ✅ Honest pricing, coupons, subscribe & save |
| 9 POS | ✅ |
| 10 Finance / ERP | ✅ Financials (no GST/AP/P&L export) |
| 11 Workforce | Basic (no rostering/production plan) |
| 12 Analytics / BI | Partial (dashboards; no unified layer) |
| 13 Loss prevention / compliance | Partial (traceability, wastage; no cold-chain) |
| 14 Infra / MLOps | ✅ Supabase + pluggable seams |

The core operational loop — **Reorder → Purchasing → Wastage → Financials** — is already closed on one honest cost figure. That's the hard part, and it's done.

---

## PART 5 — Roadmap

Phased so each step delivers value on its own and builds the data the next step needs. Roughly ordered by impact-per-effort.

### Phase 0 — Done ✅
Stock ledger · Orders/OMS · POS · Deliveries + live tracking · Suppliers & Purchase Orders · Wastage · Financials/margins · Reorder forecast (with ML seam) · Internal traceability · Honest-pricing & Subscribe-&-Save.

### Phase 1 — Tighten the fresh loop (highest impact for a meat/fresh business)
1. **Batch/expiry (FEFO) tracking** — receive stock in dated batches; deplete oldest first; flag short-dated items. *Directly cuts spoilage — your #1 cost leak.*
2. **Automated markdown for short-dated stock** — auto-suggest a clearance price before something expires, so you recover value instead of writing it off. (Pairs with FEFO; stays honest — it's a real discount, not fake MRP.)
3. **Cold-chain / temperature log** — simple manual or sensor log per batch for food safety and compliance.
4. **Production / cutting plan** — for the meat side: a daily "cut this much" sheet driven by the forecast, converting a carcass into SKUs and feeding the ledger.

### Phase 2 — Sharpen the brain (plays to your ML strength)
5. **Your own demand model** — drop it into the existing forecast seam (pincode/weekday/weather-aware, Prophet/LSTM-style, like Zepto). Data foundation (`demand_series`) is already exposed.
6. **Unified KPI / exec dashboard** — one screen: revenue, margin, wastage %, stockout rate, forecast accuracy, cover-days. The "500M-decisions" mindset at your scale.
7. **Supplier scorecards & price comparison** — track fill-rate, lead-time, price per supplier; auto-pick the best source for a reorder.

### Phase 3 — Scale to multiple locations
8. **Multi-location inventory + transfers** — treat each store/dark store separately; move stock between them.
9. **Order routing** — send each online order to the nearest location with stock.
10. **Auto rider allocation + batching + route optimisation** — attack the 40–50% last-mile cost the way the MNCs do.

### Phase 4 — Enterprise-grade back office
11. **Finance depth** — GST/tax reports, accounts payable to suppliers, full P&L, export to Tally/Zoho.
12. **Workforce** — shift rostering to the demand curve, attendance, rider payouts/performance.
13. **Loss-prevention analytics** — shrink detection, variance between expected and counted stock.

### Guiding principle
Build the layers that *differentiate you* (fresh/FEFO, your forecasting model, traceability, honest pricing). Buy or defer the *commodity* layers (payroll, accounting) until scale justifies them — exactly the build-vs-buy line the giants themselves drew.

---

## Sources
- Blinkit operations & AI logistics: [Cognitute case study](https://www.cognitute.org/case-study/blinkit-dark-store-network-and-ai-logistics), [Blinkit business model 2026](https://www.brineweb.com/blog/blinkit-business-model-revenue-model-explained-2026)
- Zepto WMS (Packman), pincode forecasting (ARIMA/Prophet/RF/LSTM): [Analytics Vidhya](https://www.analyticsvidhya.com/blog/2025/10/zepto-data-science/), [Contrary Research](https://research.contrary.com/company/zepto)
- Schwarz Group / Lidl — SAP "Elwis" €500M cancellation, own ERP on Stackit, 500M AI decisions/day, Schwarz IT: [Computer Weekly](https://www.computerweekly.com/news/252446965/Lidl-dumps-500m-SAP-project), [Procurement Magazine](https://procurementmag.com/articles/schwarz-it-better-inventory-management-through-ai), [Discount Retail Consulting](https://www.discountretailconsulting.com/post/germany-lidl-implements-a-cloud-based-erp-system)
- Grocery WMS/ERP, FEFO & fresh ops, workforce/production planning: [Manhattan Associates](https://www.manh.com/industries/grocery), [inecta](https://www.inecta.com/blog/the-role-of-wms-in-enhancing-erp-systems-for-food-distribution), [Logile fresh/recipe](https://www.logile.com/resources/blog/fresh-thinking-why-grocery-retailers-need-a-recipe-management-system)
- Last-mile dispatch (~1-min AI rider match, 40–50% of logistics cost, shared fleets): [Base blog](https://base.com/en-EN/blog/last-mile-delivery-in-quick-commerce-why-its-so-expensive-and-how-to-fix-it/), [Board Infinity](https://www.boardinfinity.com/blog/zepto-blinkit-quick-commerce-operations/)
