# Capacity verification

CI now exercises two different paths:

- The 250-product browser catalogue and public-read journey, up to 20 virtual users.
- `scripts/ci/checkout-load.mjs`: 12 concurrent backend clients create 120 COD
  orders through Supabase's HTTP RPC API, then cancel/retry half and fulfill half
  through signed-in staff RPCs. The test checks authoritative prices, delivery
  fees, all final order states, audit entries and per-product stock conservation.
  Its 480 API requests must succeed and stay below a two-second p95 CI budget.
  The populated database is then included in the executable restore drill.

Reports contain timings and counts, not credentials or customer records. These
scripts refuse hosted targets and run only against the disposable local stack.

The write baseline exercises shared backend business rules. It does not measure
Next.js Server Action overhead, network latency to India, real provider payments,
or a production peak. Before claiming capacity, agree the expected orders/minute
and simultaneous users, then run those journeys in an isolated hosted environment
with realistic stock distribution, hot products and cancellation/payment ratios.
Record results and choose headroom from the measured limit, not a CI smoke score.
