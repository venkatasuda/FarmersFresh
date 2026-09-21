#!/usr/bin/env bash
# Squash the migration history to a single baseline generated from the LIVE
# database. Run once, from the repo root, with the Supabase CLI linked to the
# production project and Docker RUNNING.
#
# Safety: nothing destructive happens unless the dump actually succeeds and
# produces a non-empty file. A failed dump (e.g. Docker not started) aborts
# before any migration is touched.
set -euo pipefail

cd "$(dirname "$0")/../.."   # repo root

BASELINE="supabase/migrations/00000000000000_baseline.sql"
SNAPSHOT="supabase/schema_snapshot.sql"
ARCHIVE="supabase/_archived_migrations"
TMP="$SNAPSHOT.tmp"

echo "==> Checking Docker is running"
if ! docker info >/dev/null 2>&1; then
  echo "Docker isn't running. Start it and wait for the engine, then re-run." >&2
  exit 1
fi

echo "==> Dumping the live schema from the linked project"
rm -f "$TMP"
supabase db dump -f "$TMP"          # set -e aborts here if the dump fails

if [ ! -s "$TMP" ] || [ "$(wc -c < "$TMP")" -lt 1000 ]; then
  rm -f "$TMP"
  echo "The dump produced an empty or truncated file. Aborting without changes." >&2
  exit 1
fi

# pg_dump 17 wraps the dump in \restrict / \unrestrict psql meta-commands, which
# the SQL migration runner can't parse. Strip just those wrapper lines.
grep -vE '^\\(restrict|unrestrict)\b' "$TMP" > "$TMP.clean" && mv "$TMP.clean" "$TMP"

echo "==> Archiving the old numbered migrations (kept in git history)"
mkdir -p "$ARCHIVE"
find supabase/migrations -maxdepth 1 -name '[0-9]*.sql' -exec git mv {} "$ARCHIVE"/ \; 2>/dev/null || \
  find supabase/migrations -maxdepth 1 -name '[0-9]*.sql' -exec mv {} "$ARCHIVE"/ \;

mv "$TMP" "$SNAPSHOT"
cp "$SNAPSHOT" "$BASELINE"

echo "==> Verifying the baseline rebuilds a fresh database cleanly"
supabase db reset

echo
echo "Done. A fresh database now builds from a single baseline:"
echo "  $BASELINE"
echo "  $SNAPSHOT (same content; used by the CI recovery path)"
