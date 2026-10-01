# Recovery and release rehearsal

## Executable fixture restore

The database CI job runs `scripts/ci/restore-drill.mjs` after the real database
tests. It checks that the connection and Docker container identify the same
disposable local cluster, backs up public/auth/storage records, empties those
tables (excluding platform migration metadata), restores with triggers disabled, and compares every table's sorted
full-row hashes. It also verifies nonnegative wallet and stock balances.
`reports/restore-drill.json` records the result without exposing backed-up data.
The script refuses hosted URLs or non-CI execution. Never relax those guards.

This tests representative record recovery on the existing schema. It does not
prove an off-site restore, Vault decryption on a replacement cluster, auth signing
key recovery or restoration of Storage object bytes.

## Hosted backup acceptance

- Identify the actual backup mechanism, retention, encryption/key custody and
  storage-object backup coverage. Assign a backup owner.
- Agree recovery targets (maximum tolerable lost orders and downtime) before
  selecting a schedule. An untested provider backup is not an accepted target.
- Restore to an isolated project with outbound notifications and subscription
  jobs disabled. Restore files and secrets through their separate mechanisms.
- Compare orders, captured payments, wallet balances, stock and event history;
  test customer login and a representative uploaded image. Measure actual loss
  and restoration time, then record whether the agreed targets were met.
- Rotate/reapply secrets through hosting settings. Confirm no duplicate
  scheduler jobs or webhook processing before admitting traffic.

## Failed release rehearsal

1. Use an isolated preview, not the live customer deployment. Record the current
   good application commit, database migration versions and provider configuration.
2. Deploy the candidate and deliberately simulate a failed health check. Route
   the preview back to its previously verified application deployment.
3. Verify login, catalogue, COD checkout, payment ownership and stock after the
   rollback. Additive schema migrations stay applied; do not blindly reverse a
   migration or edit migration history to recover business data.
4. For a schema/data defect, stop affected writes and prepare a forward repair or
   restore to an isolated database. Reconcile provider payments before resuming.
5. Record elapsed recovery time and the person authorized to restore traffic.

The [1 October demo rehearsal](demo-launch-rehearsal-2026-10-01.md) verified exact
synthetic image-byte restoration and a temporary-alias application routing rollback.
Full hosted database/storage/key restoration and operational sign-off remain
pending. Fresh migration replay and the fixture data drill are separate checks,
not substitutes for those exercises.
