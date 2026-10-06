# Validation of this edited package

Validated locally with Node 24.19.0 on 18 September 2026 against `FarmersFresh-main(1).zip`, the later uploaded version. The original production feature code and SQL function bodies were not rewritten. Changes add CI/testing/configuration and update setup guidance.

| Check | Result |
| --- | --- |
| Locked dependencies | Fresh `npm ci` succeeded after edits; new test dependencies are exact versions with lockfile updates |
| Production build | PASS: Next 16.2.10 compiled, typechecked and generated routes |
| Independent app/test TypeScript check | PASS |
| Added tests/scripts/config ESLint | PASS |
| Server/client boundary check | PASS: 80 client entry points plus pure shared modules |
| Unit/API tests | 71 executed: 67 pass, 4 fail against existing application behavior |
| Scoped coverage | 100% statements/lines/functions, 99.34% branches across six selected files. NOT application-wide coverage; coverage does not override test failures |
| Existing application ESLint | FAIL: 15 errors, 7 warnings. React effects/purity and unused code/directives; details in attached validation logs |
| Dependency audit | FAIL: npm reported 7 vulnerable dependency entries (1 moderate, 5 high, 1 critical). Next and dependencies are included. Advisories reflect the registry response at this run; review reachability and upgrade/test patched versions |
| Workflow/scanner YAML | Parsed successfully; workflow has an explicit fail-closed required-job aggregator |
| Playwright discovery | PASS: 32 configured executions across 8 scenarios and 4 browser/device projects. Discovery is NOT execution |
| Historical Supabase recreation | NOT EXECUTED locally; this workspace has no usable Docker runtime |
| Database/RLS/concurrency tests | NOT EXECUTED locally; require the Supabase PostgreSQL stack in the GitHub runner |
| Playwright execution and load smoke | NOT EXECUTED locally; require the seeded local Supabase stack |
| Docker security scanners and Deno check | NOT EXECUTED locally; provided as required CI jobs |

## Reproduced application failures

1. `toAmount("12junk")` and `toQuantity("12junk")` accept 12 because parsing stops before the trailing text. Validate the whole numeric input, not a prefix.
2. Tiny positive amounts/quantities round to zero after passing positivity validation. Revalidate the rounded result; define minimum accepted units.
3. The seeded property test reproduces the same zero-output issue (smallest counterexample `5e-324`). This is another failing test of the same defect, not a third independent bug.
4. The service worker stores the homepage navigation response. Arbitrary SSR HTML can be personalized. Restrict caching to known static assets/offline content or enforce an appropriately tested public-only strategy; bump cache version to evict old HTML.

The database tests include known remaining risks from the supplied schema, including owner settings RPC authorization, late-payment/cancellation consistency and gift-card/coupon atomicity. Until executed they are acceptance specifications, not claims that those race regressions pass.

Build success and scoped coverage do not establish launch readiness. The new workflow is expected to block release until existing application failures are corrected and all runner checks have actually passed.
