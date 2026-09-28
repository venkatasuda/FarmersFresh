#!/usr/bin/env node
// Architecture boundaries. Pure Node, no dependencies. Exits 1 on any violation.
//
//  src/server/  backend: the only code that talks to Supabase with the user's session.
//  src/lib/     shared + client-safe: formatters, types, pure helpers, the browser client.
//
//  1. Nothing in src/lib/ may import src/server/ or next/headers — lib is imported by
//     Client Components, and one server import drags next/headers into the browser
//     bundle (this broke the production build once).
//  2. No "use client" file may import src/server/ or next/headers.
//  3. Every src/server/ module starts with `import "server-only"`, so the Next build
//     itself fails if a client file reaches it. (supabase/proxy.ts is exempt: it runs
//     in proxy.ts, outside the React Server Components layer.)
//  4. src/lib/format.ts and src/lib/types.ts import no Supabase module at all.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SERVER_IMPORT = /from\s+["'](@\/server\/[^"']+|next\/headers)["']/;
const violations = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(full);
  }
  return out;
}

for (const file of walk(join(ROOT, "src"))) {
  const rel = relative(ROOT, file).split(sep).join("/");
  const src = readFileSync(file, "utf8");
  const firstLine = src.split("\n").find((l) => l.trim()) ?? "";
  const isClient = /^["']use client["']/.test(firstLine.trim());

  if ((rel.startsWith("src/lib/") || isClient) && SERVER_IMPORT.test(src)) {
    violations.push(`${rel} imports server-only code (${src.match(SERVER_IMPORT)[1]})`);
  }
  if (rel.startsWith("src/server/") && rel !== "src/server/supabase/proxy.ts" && !/^import ["']server-only["'];?$/m.test(src)) {
    violations.push(`${rel} is missing import "server-only"`);
  }
  if ((rel === "src/lib/format.ts" || rel === "src/lib/types.ts") && /from\s+["']@\/lib\/supabase\//.test(src)) {
    violations.push(`${rel} must not import any Supabase module`);
  }
}

if (violations.length) {
  console.error("Architecture boundary violations:\n" + violations.map((v) => "  - " + v).join("\n"));
  process.exit(1);
}
console.log("Architecture boundaries OK.");
