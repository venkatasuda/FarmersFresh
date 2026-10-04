// Restore an approved demo export ONLY into the disposable local recovery stack.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

assert.equal(process.argv[2], "--confirmed-demo-local", "Explicit demo recovery flag required.");
const directory = resolve(process.argv[3] || "reports/recovery-2026-10-02");
assert(directory.startsWith(resolve("reports") + "/") || directory.startsWith(resolve("reports") + "\\"), "Use an ignored reports subdirectory.");
const container = "supabase_db_farmersfresh-recovery";
const docker = process.env.DOCKER_BIN || "docker";
const run = (args, input) => {
  try { return execFileSync(docker, args, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 16_000_000 }); }
  catch (error) {
    writeFileSync(join(directory, "private-restore-error.txt"), String(error.stderr || "Docker command failed"));
    throw new Error("Recovery command failed; private diagnostics saved in the ignored backup folder.");
  }
};
const sql = query => run(["exec", "-i", container, "psql", "-X", "-qAt", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], query);
const started = Date.now();
const inspect = JSON.parse(run(["inspect", container]))[0];
assert.equal(inspect.Config.Labels["com.supabase.cli.project"], "farmersfresh-recovery", "Wrong Docker project.");
assert.equal(sql("select count(*) from public.orders;").trim(), "0", "Target must be an unused recovery database.");
assert.equal(sql("select count(*) from pg_extension where extname='pg_cron';").trim(), "0", "Recovery target must have no scheduler.");
const dump = readFileSync(join(directory, "data.sql"), "utf8").replaceAll("\r\n", "\n");
const blocks = [...dump.matchAll(/^COPY ("(?:public|auth|storage)"\."[a-z_][a-z0-9_]*") \(([^\n]+)\) FROM stdin;\n([\s\S]*?)^\\\.\n/gm)];
assert(blocks.length > 0, "No COPY records found.");
assert.equal(blocks.length, dump.match(/^COPY /gm)?.length, "Unexpected table in backup.");
assert(blocks.some(b => b[1] === '"public"."orders"' && b[3].trim()), "Backup must contain demo orders.");
const hash = rows => createHash("sha256").update(rows ? rows.replace(/\n$/, "").split("\n").sort().join("\n") : "").digest("hex");
// ponytail: full COPY blocks fit this small demo; stream large production backups.
const manifest = blocks.map(([, table, columns, rows]) => ({ table, columns, rows: rows ? rows.replace(/\n$/, "").split("\n").length : 0, sha256: hash(rows) }));
for (const item of manifest) {
  assert.match(item.columns, /^"[a-z_][a-z0-9_]*"(?:, "[a-z_][a-z0-9_]*")*$/);
  sql(`select ${item.columns} from ${item.table} limit 0;`); // Fail before mutation on platform schema drift.
}
const sequences = dump.split("\n").filter(line => /^SELECT pg_catalog\.setval\('"(?:public|auth|storage)"\."[a-z_][a-z0-9_]*"', \d+, (?:true|false)\);$/.test(line));
assert.equal(sequences.length, dump.match(/^SELECT pg_catalog\.setval/gm)?.length || 0, "Unexpected sequence statement.");
sql(`begin; set local session_replication_role=replica; set local timezone='UTC';
truncate ${manifest.map(t => t.table).join(",")} cascade;
${blocks.map(b => b[0]).join("\n")}
${sequences.join("\n")}
commit;`);
for (const item of manifest) {
  const restored = sql(`set timezone='UTC'; COPY (select ${item.columns} from ${item.table}) TO STDOUT;`);
  assert.equal(hash(restored), item.sha256, `Restored rows differ: ${item.table}`);
}
for (const statement of sequences) {
  const [, sequence, value, called] = statement.match(/setval\('([^']+)', (\d+), (true|false)\)/);
  assert.equal(sql(`select last_value || ':' || is_called from ${sequence};`).trim(), `${value}:${called}`, `Sequence differs: ${sequence}`);
}
const invalid = sql(`select count(*) from (
  select org_id,user_id from public.wallet_ledger group by org_id,user_id having sum(amount)<0
  union all select location_id,product_id from public.stock_movements group by location_id,product_id having sum(delta)<0
) bad;`).trim();
assert.equal(invalid, "0", "Negative wallet or stock balance.");
const report = { passed: true, source: "bjevoybwufubtprkxbvb demo export", target: container,
  finishedAt: new Date().toISOString(), restoreAndVerifySeconds: (Date.now() - started) / 1000,
  tables: manifest.length, rows: manifest.reduce((n, t) => n + t.rows, 0), manifest,
  scope: "Exported public/auth/storage rows and sequence values; platform configuration, encryption keys, and object bytes require separate verification." };
writeFileSync(join(directory, "database-verification.json"), JSON.stringify(report, null, 2));
console.log(`Restored and verified ${report.rows} rows across ${report.tables} tables; stock and wallet checks passed.`);
