#!/usr/bin/env node
// Read the running local Supabase's connection details and export them for the
// steps that follow. In GitHub Actions we append to $GITHUB_ENV; run locally it
// prints `export` lines you can eval. Usage: node scripts/ci/export-local-env.mjs [workdir]

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const workdir = process.argv[2] || ".";

// `supabase status -o env` prints KEY="value" lines (API_URL, DB_URL, ANON_KEY,
// SERVICE_ROLE_KEY, ...).
let raw;
try {
  raw = execFileSync("supabase", ["status", "--workdir", workdir, "-o", "env"], {
    encoding: "utf8",
  });
} catch (e) {
  console.error("Couldn't read `supabase status`. Is the local stack running?");
  console.error(e.message);
  process.exit(1);
}

const env = {};
for (const line of raw.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m) env[m[1]] = m[2];
}

// Map Supabase's status keys to the names the app and tests expect.
const mapped = {
  SUPABASE_DB_URL: env.DB_URL,
  NEXT_PUBLIC_SUPABASE_URL: env.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: env.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY,
};

const missing = Object.entries(mapped).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error("Supabase status did not provide: " + missing.join(", "));
  process.exit(1);
}

const lines = Object.entries(mapped).map(([k, v]) => `${k}=${v}`);
if (process.env.GITHUB_ENV) {
  appendFileSync(process.env.GITHUB_ENV, lines.join("\n") + "\n");
  console.log("Exported Supabase env to $GITHUB_ENV: " + Object.keys(mapped).join(", "));
} else {
  for (const l of lines) console.log("export " + l);
}
