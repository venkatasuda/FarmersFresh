# Demo verification — 1 October 2026

The owner confirmed that `farmersfresh.vercel.app` and Supabase project
`bjevoybwufubtprkxbvb` contain demo data. This is not production acceptance.

## Verified

- Applied the security, restored-permissions, stock/wallet and operations/store-scope migrations.
  Migration history matches the repository filenames after the owner's approved repair.
- Guest checkout reserves stock; owner cancellation releases it once even when
  repeated. Negative stock and empty-wallet debits fail. These hosted checks used
  a transaction that rolled back all fixture rows; the two existing orders and
  one existing user remain.
- Stock and wallet insertion guards serialize writes, including previously empty
  ledgers. Subscription runs lock their due cycle and use the shop's delivery fee.
  Return approvals lock the request; tips write an audit event.
- Worker version 11 requires a dedicated bearer token. The token is stored in
  Edge Function secrets and encrypted Vault, with no client Vault access.
  The existing scheduler reads the token from Vault instead of embedding it.
  An unauthenticated POST returned 401; the owner-approved authenticated run
  returned 200 with zero sent, skipped or failed on an empty pending queue.
- [CI for commit 28b7ee9](https://github.com/venkatasuda/FarmersFresh/actions/runs/36898956142)
  passed: 138 unit/API tests, 71 PostgreSQL tests, 39 browser tests, historical
  migration replay, security scans, production build and public-read load smoke.
  The database tests include checkout/POS/subscription competition, wallet
  spending, duplicate return approval and duplicate subscription execution.
- The disposable restore drill emptied and restored records successfully: all
  85 table checksums matched, and stock/wallet invariants passed.
- The 250-product public-read load smoke completed 684 requests with no failures
  at up to 20 virtual users; request p95 was 792 ms. This is a local CI baseline,
  not a production capacity claim or a write-heavy checkout benchmark.
- Vercel CLI access is verified. The owner's approved server-role and monitoring
  secrets are encrypted and restricted to the `codex/security-hardening` preview
  branch. Protection remains enabled. The
  [verified preview](https://farmers-fresh-51h97wfct-venkatasudas-projects.vercel.app)
  returns authenticated metrics with no caching; missing tokens return 401.
- A temporary confirmed test account signed in through Supabase password Auth.
  Its customer account returned 200, customer uploads were denied with 403,
  invalid owner images were rejected with 415, and an owner PNG upload returned
  a successfully downloaded JPEG. Unauthenticated uploads return 401. The test
  account, isolated organization, profile and uploaded object were removed.
  `scripts/ci/verify-demo-auth.mjs` makes these checks repeatable; it accepts the
  demo project's CLI API-key JSON on stdin and refuses other preview hostnames.
- Added Prometheus/Grafana provisioning, business metrics, tested alert rules
  and staff/recovery runbooks. Manager/staff/accountant and cross-store return
  checks are covered by database tests; broader operational role review remains.

## Remaining launch gates, in order

1. Complete hosted COD customer order/cancellation workflows, Razorpay test
   capture/duplicate webhook/refund, and
   notifications to explicitly selected test recipients. Provider keys are absent
   from Edge Function secrets, so real notification delivery is unverified.
   Vercel currently has no Razorpay test keys. Confirm the original-payment
   refund/reconciliation procedure; wallet credit is not a provider refund.
   Supabase reports leaked-password protection disabled; review hosted Auth
   configuration before accepting customers.
2. Expand role/store permission checks beyond the existing tenant/RLS tests.
3. Run the monitoring stack on a persistent Docker host and configure/test an
   alert destination. Provisioned files and a working endpoint do not deliver alerts.
4. Restore an actual hosted backup, including Storage bytes and replacement
   secrets, to an isolated environment; rehearse release recovery. The fixture
   drill does not prove hosted disaster recovery.
5. Verify staff order, delivery, return and reconciliation procedures.
6. Measure realistic catalogue and order load before setting a capacity claim.

The draft PR remains open. Do not treat green CI as completion of these gates.

Token rotation must update both `NOTIFICATION_WORKER_SECRET` in Edge Function
secrets and the `notification_worker_secret` Vault entry. Never paste the token
into source, cron command text or logs. See
[Supabase's scheduling guide](https://supabase.com/docs/guides/functions/schedule-functions).
