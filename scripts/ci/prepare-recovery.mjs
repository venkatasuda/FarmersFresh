#!/usr/bin/env node
// Build a `.ci-recovery` Supabase workdir that reconstructs the database from
// the live-schema SNAPSHOT (supabase/schema_snapshot.sql) rather than replaying
// the numbered migrations. This gives the database/browser jobs a fast, known
// schema to test against, while the separate `migrations` job still gates launch
// by replaying every historical migration on a fresh DB.
//
// Assumes schema_snapshot.sql is a `supabase db dump` output (safe to apply on a
// fresh local database). Regenerate it with:  supabase db dump -f supabase/schema_snapshot.sql

import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SNAPSHOT = join(ROOT, "supabase", "schema_snapshot.sql");
const CONFIG = join(ROOT, "supabase", "config.toml");
const OUT = join(ROOT, ".ci-recovery", "supabase");

if (!existsSync(SNAPSHOT)) {
  console.error(`Missing ${SNAPSHOT}. Generate it with: supabase db dump -f supabase/schema_snapshot.sql`);
  process.exit(1);
}

mkdirSync(join(OUT, "migrations"), { recursive: true });

// A distinct project_id so the recovery stack's Docker containers never clash
// with the migrations job's default stack.
const config = readFileSync(CONFIG, "utf8").replace(
  /^project_id\s*=.*$/m,
  'project_id = "farmersfresh-recovery"'
);
writeFileSync(join(OUT, "config.toml"), config);

// The snapshot becomes the single migration `supabase start` applies.
copyFileSync(SNAPSHOT, join(OUT, "migrations", "00000000000000_snapshot.sql"));

console.log("Prepared .ci-recovery from schema_snapshot.sql");
