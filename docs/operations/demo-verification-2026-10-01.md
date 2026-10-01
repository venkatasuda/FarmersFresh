# Demo verification — 1 October 2026

The owner confirmed that `farmersfresh.vercel.app` and Supabase project
`bjevoybwufubtprkxbvb` contain demo data. This is not production acceptance.

## Verified

- Applied the security, restored-permissions and stock/wallet migrations.
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
- [CI for commit 5e7c6dc](https://github.com/venkatasuda/FarmersFresh/actions/runs/36891318292)
  passed: 136 unit/API tests, 65 PostgreSQL tests, 39 browser tests, historical
  migration replay, security scans, production build and public-read load smoke.
  The database tests include checkout/POS/subscription competition, wallet
  spending, duplicate return approval and duplicate subscription execution.

## Remaining launch gates, in order

1. Exercise the current PR preview against this demo database: signed-in customer
   workflows, owner upload, Razorpay test capture/duplicate webhook/refund, and
   notifications to explicitly selected test recipients. Provider keys are absent
   from Edge Function secrets, so real notification delivery is unverified.
   Vercel's connector currently cannot access the project's team; its GitHub
   deployment check is green, but that does not verify hosting configuration.
   The [current PR preview](https://farmers-fresh-93p8v5b3h-venkatasudas-projects.vercel.app)
   redirects to Vercel login; hosted application checks require preview access.
   Supabase reports leaked-password protection disabled; review hosted Auth
   configuration before accepting customers.
2. Expand role/store permission checks beyond the existing tenant/RLS tests.
3. Add operational alerts for stuck orders, pending refunds, failed notifications
   and low stock. Public-read load smoke is not business monitoring.
4. Restore a backup containing representative records and rehearse release
   recovery. Fresh-schema replay is not proof of data recovery.
5. Verify staff order, delivery, return and reconciliation procedures.
6. Measure realistic catalogue and order load before setting a capacity claim.

The draft PR remains open. Do not treat green CI as completion of these gates.

Token rotation must update both `NOTIFICATION_WORKER_SECRET` in Edge Function
secrets and the `notification_worker_secret` Vault entry. Never paste the token
into source, cron command text or logs. See
[Supabase's scheduling guide](https://supabase.com/docs/guides/functions/schedule-functions).
