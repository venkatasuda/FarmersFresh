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
//  5. App code never writes money/stock/order tables directly — those changes go
//     through database functions so the website, a mobile app and any API client
//     share one set of rules. Only the payment-order adapter may attach a
//     Razorpay id through a conditional update; settlement still uses RPCs.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SERVER_IMPORT = /from\s+["'](@\/server\/[^"']+|next\/headers)["']/;
const RULE_TABLES = "orders|order_items|payments|payment_events|wallet_ledger|stock_movements|events|gift_cards|sales|sale_items";
const DIRECT_WRITE = new RegExp(`\\.from\\(\\s*["'](${RULE_TABLES})["']\\s*\\)\\s*\\.\\s*(insert|update|upsert|delete)\\(`);
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
  // Keep the pre-existing payment plumbing exception narrow after moving it
  // out of app/api: only setting the gateway id is permitted here.
  const checkedSource = rel === "src/server/payments/order.ts"
    ? src.replace(/\.from\("orders"\)\s*\.update\(\{ razorpay_order_id: rp\.id \}\)/g, "")
    : src;
  const write = checkedSource.match(DIRECT_WRITE);
  if (write) {
    violations.push(`${rel} writes "${write[1]}" directly — add or use a database function instead`);
  }
  if ((rel === "src/lib/format.ts" || rel === "src/lib/types.ts") && /from\s+["']@\/lib\/supabase\//.test(src)) {
    violations.push(`${rel} must not import any Supabase module`);
  }
  if ((rel.startsWith("src/lib/") || rel.startsWith("src/components/")) && /from\s+["']@\/features\//.test(src)) {
    violations.push(`${rel} imports a feature — shared modules must not depend on features`);
  }
  if (rel.startsWith("src/server/") && /from\s+["']@\/features\//.test(src)) {
    violations.push(`${rel} imports frontend code — move its shared contract into src/lib/contracts/`);
  }
  if (!rel.startsWith("src/server/") && /from\s+["']@supabase\/supabase-js["']/.test(src) && !/^import type .*from ["']@supabase\/supabase-js["'];?$/m.test(src)) {
    violations.push(`${rel} imports the privileged-capable Supabase client outside src/server/`);
  }
  if (rel.startsWith("src/app/") && /\.rpc\(/.test(src)) {
    violations.push(`${rel} calls a database RPC directly — use its server domain module`);
  }
}

if (violations.length) {
  console.error("Architecture boundary violations:\n" + violations.map((v) => "  - " + v).join("\n"));
  process.exit(1);
}
console.log("Architecture boundaries OK.");
