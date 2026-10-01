// Rehearse application routing on an owned temporary alias; never move live aliases.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const [good, candidate] = process.argv.slice(2);
const deployment = /^https:\/\/farmers-fresh-[a-z0-9]+-venkatasudas-projects\.vercel\.app$/;
assert.match(good || "", deployment); assert.match(candidate || "", deployment);
assert.notEqual(good, candidate);
const alias = `farmers-fresh-rehearsal-${randomUUID().slice(0, 8)}.vercel.app`;
const npm = "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js";
function cli(args) {
  return execFileSync(process.execPath, [npm, "exec", "--yes", "--package=vercel", "--", "vercel", ...args],
    { encoding: "utf8", timeout: 120000, env: { ...process.env, VERCEL_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
}
function status(path) {
  const output = cli(["curl", path, "--deployment", `https://${alias}`, "--", "--silent", "--show-error",
    "--output", process.platform === "win32" ? "NUL" : "/dev/null", "--write-out", "FF_STATUS%{http_code}"]);
  const match = output.match(/FF_STATUS(\d{3})/); assert(match, "HTTP status missing"); return Number(match[1]);
}
let created = false;
try {
  cli(["alias", "set", good, alias]); created = true;
  assert.equal(status("/login"), 200, "Baseline login route");
  cli(["alias", "set", candidate, alias]);
  // Intentionally omit monitoring authorization to simulate a failed release gate.
  const simulatedFailure = status("/api/operations/metrics");
  assert([401, 503].includes(simulatedFailure), "Unauthorized or unconfigured health gate must reject");
  const started = Date.now();
  cli(["alias", "set", good, alias]);
  assert.equal(status("/login"), 200, "Login after application routing rollback");
  assert.equal(status("/"), 200, "Catalogue after application routing rollback");
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/demo-rollback.json", JSON.stringify({ passed: true, good, candidate,
    recoveryMs: Date.now() - started, login: 200, catalogue: 200, simulatedFailure,
    scope: "temporary application alias; no database reversal or live traffic switch" }, null, 2));
  console.log("Isolated application routing rollback passed; login and catalogue restored.");
} finally {
  if (created) cli(["alias", "remove", alias, "--yes"]);
  console.log("Temporary rehearsal alias removed; live aliases untouched.");
}
