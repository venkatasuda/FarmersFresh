# Production CI and launch controls

This package adds release checks to the supplied application. It does not certify the current application for launch. The first local run has already found failing application tests and dependency advisories. Resolve failures; do not lower thresholds or skip tests to get a green badge.

## Implemented checks

| Required job | Checks and evidence |
| --- | --- |
| Quality | Blocking ESLint with zero warnings, independent Next route type generation and TypeScript check, transitive server/client import boundary analysis |
| Unit/API | Actual numeric/error/formatting helpers; actual Razorpay order, membership, callback and webhook route handlers with controlled DB/provider substitutes; service-worker privacy behavior; reproducible property testing |
| Coverage | Minimum 90% statements/lines/functions and 85% branches on six explicitly selected files; coverage and JUnit reports uploaded even on failure |
| Supply chain | Full npm dependency audit blocks high/critical advisories; CycloneDX software bill of materials; locked npm dependencies and automated update PRs |
| Secrets | Redacted Gitleaks scan of the entire checked-out Git history |
| Static security | Versioned local Semgrep rules for dynamic code execution, disabled TLS validation, exposed service-role/payment secrets and shell execution in application code |
| Edge worker | Deno typecheck of the notification function, which the existing application tsconfig excludes |
| Migration reconstruction | Start a disposable Supabase stack; reset from the historical migration directory; database function linting. No production credentials |
| Database regression | Real PostgreSQL roles and JWT claims, profile privilege checks, cross-tenant isolation, owner/staff permissions, wallet privacy, checkout validation/pricing/stock, payment privileges/replay/amount/expiry, append-only audit behavior, RPC existence and RLS contracts |
| Concurrency | Independent connections and observable PostgreSQL lock barriers for competing gift-card redemptions, last-stock checkouts, last-use coupons and webhook versus stale cancellation |
| Production/browser | Production Next build and Playwright on Chromium, Firefox, WebKit and Android-sized Chromium; real guest COD checkout and database assertions; forged payment requests; protected-route redirects; serious/critical WCAG checks on staff login; responsive cart; security headers |
| Load smoke | Ten concurrent readers for 20 seconds against the local built application; <1% failed requests, >99% successful checks, p95 response below 2 seconds |
| Launch gate | An always-run aggregator fails if any required job failed, was cancelled or was skipped |

The coverage denominator is six files: `lib/format.ts`, `lib/guard.ts`, and four Razorpay routes (order creation, membership creation, verification, webhook). It is NOT whole-application coverage. API tests substitute the gateway and database; the separate database tests exercise actual SQL. The load smoke measures regressions on a CI runner, not production capacity.

The Node runtime is pinned to 22.23.2 (verified against the npm Node 22 versions at this run).

The pipeline runs on main pushes, PRs, manual dispatch and nightly. PR supersessions can cancel old runs; main runs remain available as release evidence. Root permissions are read-only. Common GitHub actions use immutable commit references. Supabase/Deno setup actions and scanner container images use version tags; pin these to audited commit/image digests when managing your release infrastructure.

## Database reconstruction and the recovery path

The uploaded ZIP includes a schema snapshot through migration 0079 but has incomplete historical function definitions. These are different checks:

1. `migrations` rebuilds the HISTORICAL chain. This remains required and must fail when the chain cannot recreate the app.
2. `database` and `production-browser` use an isolated `.ci-recovery/` stack from the supplied snapshot, followed by migrations newer than `schema_snapshot.meta.json`'s explicit boundary. This lets regression tests run independently of the broken history.

The script only removes pg_dump's psql restrict/unrestrict commands and makes `CREATE SCHEMA public` tolerate Supabase's existing public schema. It does not change function bodies, policies or grants. No fake implementations fill missing historical functions. The recovery route is not a migration repair and cannot make the launch gate pass by itself.

After repairing/re-baselining migrations and proving a clean reset, switch regression/browser jobs to the canonical directory and retire the recovery route. Test both a clean installation and an upgrade from the prior released schema with representative synthetic data. Do not mark migrations applied on production merely to silence failures.

## Repository settings required

Workflow YAML alone cannot prevent deployments or direct pushes. Configure these controls in GitHub and your hosting dashboard:

- Require `Launch gate` in a main-branch ruleset, require PR review, prevent force pushes and restrict bypass rights.
- Remove any hosting-provider integration that publishes main before these checks pass. The old unconditional Vercel deployment job was removed from this package.
- Trigger production promotion only after success for the exact commit being promoted. Build with the intended production public variables; artifacts built for a local database cannot be promoted unchanged because `NEXT_PUBLIC_*` values are compiled in.
- Use a protected production environment and dedicated, narrowly scoped deployment credentials. CI tests need no production Supabase or payment secrets.
- Ensure private/fork PRs still execute every required check. Never run untrusted PR code using `pull_request_target` with production credentials.

No external repository settings or live deployments were changed by this ZIP edit. There is no automatic deployment in the new workflow.

## Running checks

Use Node 22.16+ (22 or 24), a pinned compatible Supabase CLI (workflow uses 2.76.8), and Docker Desktop/Engine for Supabase tests.

```bash
npm ci
npm run lint
npm run typecheck
npm run ci:boundaries
npm run test:coverage

# Canonical recreation check: this should expose incomplete historical migrations.
supabase start
supabase db reset --local
supabase db lint --local --level error --fail-on error
supabase stop --no-backup

# Separate disposable recovery regression environment.
npm run ci:recovery
supabase start --workdir .ci-recovery
node scripts/ci/export-local-env.mjs .ci-recovery
# In bash, load the locally generated test values; never commit this file.
set -a
source .env.test.local
set +a
npm run test:database
node scripts/ci/seed-browser.mjs
npm run build
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
supabase stop --workdir .ci-recovery --no-backup
```

The database fixtures commit only to a disposable localhost database. Tests and browser seeding reject remote database hostnames. The concurrency suite intentionally leaves synthetic committed data in that disposable instance; recreate it between full runs. Notification provider keys remain unset, so no real customer messages are sent. No test makes a real Razorpay charge.

## Additional launch coverage still needed

This is an implemented starting suite, not complete coverage of every financial feature. Add these tests alongside fixes before enabling those features in production:

| Feature | Acceptance tests to add |
| --- | --- |
| Inventory/POS | Online versus POS versus subscriptions for the last unit; no pre-existing ledger row; multi-product deadlock handling; transfer consistency; units/pack increments |
| Wallet/rewards | Two simultaneous wallet spends; tenant-scoped balances; referral/scratch replay; rollback and ledger uniqueness; customer refunds |
| Payments | Provider test-mode capture/refund flow, lost browser callback, lost webhook, webhook out-of-order/unmatched reprocessing, partial/full refunds, membership amount validation, retry/capture failure and reconciliation alerts |
| Authorization | Every role/capability against every admin RPC and direct table mutation; same-org cross-location isolation; revoked staff sessions; guest order access; forged/missing identities |
| Checkout/account | Customer login and ownership, guest lookup tokens, saved-address/PIN precedence, payment resume after refresh, pending membership reuse, verified confirmation, cancellation |
| Notifications/jobs | Competing workers claim one job, expired leases/retries, external-send success plus DB failure, provider idempotency and dead-letter handling |
| Public APIs | Visual-search size/MIME/magic-byte/rate/quota checks, slow upstream timeout, malformed primitive JSON and large webhook payloads |
| Security/browser | Accessibility beyond the login page, logout/offline isolation, cart keyboard use, session/cookie and CSRF tests, staging active security scans |
| Release operations | Staging upgrade/backfill, backups restored and business invariants verified, failure/rollback rehearsals, provider outage and delayed job recovery, sustained load with representative production data |

Set service-level targets from measurements on staging hardware. A CI performance budget cannot establish how many real customers the store can handle.

## Sources

[Supabase database/RLS testing and application-level isolation](https://supabase.com/docs/guides/local-development/testing/overview)
[Playwright webServer facility](https://playwright.dev/docs/test-webserver)
[GitHub protected deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
