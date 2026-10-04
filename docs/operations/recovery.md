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

## Demo export to a replacement local cluster (2 October 2026)

The [2 October recovery rehearsal](recovery-rehearsal-2026-10-02.md) restored
the hosted demo's exported records into a separate local Supabase cluster.
Every exported row and sequence matched; restored login, owner permissions and
a synthetic hosted-to-local image copy passed. This is stronger evidence than
restoring fixtures in the same database, but does not establish off-site retention,
hosted replacement provisioning or recovery of platform encryption keys.

Repeat with an explicitly approved demo export only:

1. Export schema and data sequentially using `supabase db dump --linked` into
   an ignored `reports/` subdirectory. Data flags: `--data-only --use-copy
   --schema public,auth,storage`. The schema export uses `--schema public`.
   Run sequentially because CLI temporary login credentials can change between calls.
2. Run `npm run ci:recovery`, then use the generated `.ci-recovery` configuration
   for an unused local stack. For this Windows rehearsal, API/database/shadow
   ports were changed to 55321/55322/55320 because Windows reserved 54322.
   Start Auth, Storage and REST with cron and outbound workers absent.
3. Run `node scripts/ci/verify-demo-recovery.mjs --confirmed-demo-local
   reports/<backup-directory>`. Set `DOCKER_BIN` if Docker is outside PATH.
   It accepts only the named recovery container, refuses a target containing
   orders or a cron extension, checks all columns before mutation, then restores
   in a transaction and compares hashes and sequence state. Managed platform
   migrations stay intact. Any incompatible schema stops the rehearsal.
4. Save `supabase status --workdir .ci-recovery -o json` to
   `<backup-directory>/local-credentials.json`, without printing or committing it.
   Pipe `supabase projects api-keys --project-ref bjevoybwufubtprkxbvb -o json`
   into `node scripts/ci/verify-demo-recovery-services.mjs --confirmed-demo-local
   reports/<backup-directory>`. This requires the local API on port 55321.
   It verifies a restored owner's one-use local login, then backs up and restores
   one unique synthetic image from the approved demo. Both test objects are removed.
5. Retain the sanitized verification reports with the operational evidence.
   Backups, credentials and private diagnostics remain excluded from Git. Stop
   the recovery services when finished; do not use this local copy for customer traffic.

The scripts are deliberately scoped to this small demo. They load data in memory;
large databases require a streamed backup/verification process. The service check
does not copy an existing file library: production needs a separately inventoried,
encrypted object backup and a complete restore test. Follow the current
[Supabase backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
for platform settings, managed schema customizations and encryption-key handling.
