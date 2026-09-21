# CI run-checklist

How to reproduce each `Production CI` job locally before pushing. Jobs are grouped
by what they need: most only need Node; three need Docker + the Supabase CLI.

## Prerequisites

- Node 22.16+ and a clean install: `npm ci`
- For the database / browser / migrations jobs: Docker Desktop running and the
  Supabase CLI linked — `supabase link --project-ref bjevoybwufubtprkxbvb`
- One-time reproducibility fix (see below) before the DB jobs can pass:
  `.\scripts\db\rebaseline.ps1`

## Node-only jobs (no Docker)

| CI job | Run locally | Notes |
|--------|-------------|-------|
| `quality` | `npm run lint` · `npm run typecheck` · `npm run ci:boundaries` | Lint is zero-warnings. `ci:boundaries` fails if a client-safe lib or a `"use client"` file imports a server-only module. |
| `unit-api` | `npm run test:coverage` | Pure-logic unit tests in `tests/unit/` (format, catalogue, delivery-fee, a fast-check property). No DB. |
| `supply-chain` | `npm audit --audit-level=high` | Also emits an SBOM in CI; locally the audit is the gate. |
| `secrets` | (CI only) Gitleaks over full history | Needs Docker; not usually run locally. |
| `static-security` | `docker run --rm -v "${PWD}:/src" semgrep/semgrep:1.130.0 semgrep scan --config /src/security/semgrep.yml --error /src/app /src/lib` | Rules live in `security/semgrep.yml`. Must find nothing. |
| `edge-types` | `deno check supabase/functions/send-notifications/index.ts` | Needs Deno 2.x. |

## Reproducibility fix (run once, before the DB jobs)

The live database is the source of truth; the numbered migration history can no
longer rebuild it (many functions were created directly against the DB). Squash
to a single baseline generated from live:

```powershell
.\scripts\db\rebaseline.ps1      # PowerShell
# or, in Git Bash / WSL:
bash scripts/db/rebaseline.sh
```

This dumps the live schema to `supabase/schema_snapshot.sql`, archives the old
numbered migrations to `supabase/_archived_migrations/`, writes the dump as
`supabase/migrations/00000000000000_baseline.sql`, and runs `supabase db reset`
to prove a fresh database builds cleanly. If `db reset` errors, fix the offending
statement in the baseline and re-run.

## Docker + Supabase jobs

| CI job | Run locally | Notes |
|--------|-------------|-------|
| `migrations` | `supabase start` · `supabase db reset --local` · `supabase db lint --local --level error` · `supabase stop --no-backup` | Rebuilds from the baseline and lints. |
| `database` | `npm run ci:recovery` · `supabase start --workdir .ci-recovery` · `node scripts/ci/export-local-env.mjs .ci-recovery` · `npm run test:database` | Structural security assertions in `tests/database/` against the recovery schema. Needs `SUPABASE_DB_URL` (the export step sets it). |
| `production-browser` | `npm run ci:recovery` · `supabase start --workdir .ci-recovery` · `node scripts/ci/export-local-env.mjs .ci-recovery` · `node scripts/ci/seed-browser.mjs` · `npx playwright install --with-deps` · `npm run build` · `npm run test:e2e` | Public-route smoke + a11y in `tests/e2e/`. The k6 load step is a light smoke, not a capacity test. |

To run the database tests without the recovery workdir, point them at any local
Postgres: set `SUPABASE_DB_URL` (e.g. from `supabase status -o env` → `DB_URL`)
and run `npm run test:database`. With no URL set, that suite skips rather than
fails.

## Launch gate

`launch-gate` just fails if any required job above didn't succeed. Green locally
on all of the above ⇒ green gate.
