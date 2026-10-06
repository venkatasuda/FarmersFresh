# Demo recovery rehearsal — 2 October 2026

Source: approved demo Supabase project `bjevoybwufubtprkxbvb`.
Target: a separate local `farmersfresh-recovery` cluster, PostgreSQL 17.11,
reconstructed from the repository schema snapshot and all 13 later migrations.
Hosted source data was not emptied or modified during database restoration.

## Verified

- Exported public schema and public/auth/storage records using the authenticated
  Supabase CLI. Backup files and credentials are under ignored `reports/`.
- Restored **1,912 rows across 91 tables**, including **six orders and three
  Auth accounts**. Sorted SHA-256 fingerprints of every exported column matched
  the restored COPY output. Exported sequences also matched.
- No negative aggregate stock or wallet balances. The restore and comparison
  took **159.924 seconds**, excluding tool downloads, stack initialization,
  backup export and service checks; this is not an end-to-end recovery target.
- A restored active owner signed in using a local one-use Auth token and called
  the role-restricted monitoring RPC successfully. Existing password hashes were
  included in the row comparison; existing-password sign-in was not exercised.
- The source had **zero stored objects** at backup time. A unique synthetic JPEG
  was uploaded to the demo, downloaded to a backup file, restored into the local
  bucket and downloaded again. SHA-256 bytes matched. Both synthetic objects
  were removed; no existing source file was changed.
- Recovery cron and Edge Function workers were absent, so restored queued
  notifications and subscriptions were not processed.

The local API/database ports are 55321/55322. Windows reserved the normal
database port 54322. The platform initialized a newer PostgreSQL patch release
than the source (17.6); the column preflight and data verification passed.

## Other launch work completed

- Monitoring PR #12 merged at `55f7fc87a61b2c0399d017c9bd9c8da323fded3e`.
  Required CI checks passed; the main site's monitoring route redirects anonymous
  requests to login.
- Replaced the monitoring Resend credential exposed in chat with a sending-only
  key scoped to `mail.farmersfresh.store`. Alertmanager delivered a verification
  email to the approved inbox. The old key was revoked and the API confirmed
  it invalid; temporary key copies were removed. The separate order-email key
  was not changed.

## Still required before claiming disaster-recovery readiness

- An encrypted off-site backup destination, retention schedule, key custody,
  named recovery owner and agreed maximum data loss/downtime.
- Restore into a replacement hosted project, including platform configuration,
  Vault/encryption-key handling, Auth provider settings, function secrets,
  migration history and a complete object inventory when files exist.
- Controlled scheduler/webhook reactivation and payment reconciliation before
  switching real traffic. No hosted traffic switch occurred in this rehearsal.
- Human staff workflow sign-off and a hosted capacity test sized to the expected
  launch traffic. Existing CI load checks are baselines, not a production capacity claim.
- Razorpay capture/refund verification when the account is available; COD can
  remain the initial payment method. Monitoring still requires this PC to stay awake.
