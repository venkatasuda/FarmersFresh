#!/usr/bin/env node
// Architecture boundaries (see the header of lib/format.ts for the "why").
//
//  1. lib/format.ts and lib/types.ts are imported by Client Components, so they
//     must never pull in server-only modules — doing so drags next/headers into
//     a client bundle and breaks the production build.
//  2. Any "use client" file must not import a server-only module either.
//
// Pure Node, no dependencies. Exits 1 with a list of violations.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SERVER_ONLY = [
  /from\s+["']@\/lib\/supabase\/server["']/,
  /from\s+["']next\/headers["']/,
];
const CLIENT_SAFE_FILES = ["lib/format.ts", "lib/types.ts"];

const violations = [];

function check(file, isClientContext) {
  const src = readFileSync(file, "utf8");
  for (const re of SERVER_ONLY) {
    if (re.test(src)) {
      violations.push(`${relative(ROOT, file)} imports a server-only module (${re.source})`);
    }
  }
  // A client-safe lib must not import ANY supabase module, server or not.
  if (!isClientContext && /from\s+["']@\/lib\/supabase\//.test(src)) {
    violations.push(`${relative(ROOT, file)} must not import from lib/supabase/* (client-safe file)`);
  }
}

// Rule 1: the two client-safe libs.
for (const rel of CLIENT_SAFE_FILES) {
  try {
    check(join(ROOT, rel), false);
  } catch {
    violations.push(`${rel} is missing`);
  }
}

// Rule 2: every "use client" component.
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      const src = readFileSync(full, "utf8");
      const firstLine = src.split("\n").find((l) => l.trim().length > 0) ?? "";
      if (/^["']use client["']/.test(firstLine.trim())) check(full, true);
    }
  }
}
walk(join(ROOT, "app"));

if (violations.length) {
  console.error("Architecture boundary violations:\n" + violations.map((v) => "  - " + v).join("\n"));
  process.exit(1);
}
console.log("Architecture boundaries OK.");
