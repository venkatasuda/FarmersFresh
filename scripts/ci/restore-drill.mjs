// Destructive ONLY in the disposable CI recovery container, after database tests.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { Client } from "pg";

const connectionString = process.env.TEST_DATABASE_URL;
const url = new URL(connectionString || "https://invalid");
if (process.env.CI !== "true" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.port !== "54322" || url.pathname !== "/postgres") {
  throw new Error("Restore drill requires CI=true and the disposable local Supabase postgres database on port 54322.");
}
const container = "supabase_db_farmersfresh-recovery";
const client = new Client({ connectionString });
const dump = "/tmp/farmersfresh-restore-drill.dump";
const docker = args => execFileSync("docker", ["exec", container, ...args], { stdio: "pipe", maxBuffer: 8_000_000 });
const quoted = value => '"' + value.replaceAll('"', '""') + '"';
await client.connect();
try {
  // Prove this container is the database reached by the test URL before touching data.
  const remote = await client.query("show system_identifier").catch(() => client.query("select system_identifier::text from pg_control_system()"));
  const local = docker(["psql", "-U", "postgres", "-d", "postgres", "-Atc", "select system_identifier::text from pg_control_system()"]);
  if (String(Object.values(remote.rows[0])[0]).trim() !== local.toString().trim()) throw new Error("Container/database mismatch.");
  const tables = (await client.query(`select n.nspname schema,c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','auth','storage') and c.relkind='r'
      and not (n.nspname in ('auth','storage') and c.relname in ('schema_migrations','migrations'))
      and not exists(select 1 from pg_depend d where d.objid=c.oid and d.classid='pg_class'::regclass and d.deptype='e')
    order by n.nspname,c.relname`)).rows;
  async function manifest() {
    const result = {};
    for (const table of tables) {
      const name = `${quoted(table.schema)}.${quoted(table.name)}`;
      // ponytail: full-row hashes fit CI fixtures; use streamed checksums for large restores.
      const data = await client.query(`select count(*)::int row_count,md5(coalesce(string_agg(hash,'' order by hash),'')) hash
        from (select md5(row_to_json(t)::text) hash from ${name} t) fingerprints`);
      result[`${table.schema}.${table.name}`] = data.rows[0];
    }
    return result;
  }
  const before = await manifest();
  if (!before["public.orders"]?.row_count || !before["public.wallet_ledger"]?.row_count) throw new Error("Recovery fixtures must include orders and wallet records.");
  docker(["pg_dump", "-U", "supabase_admin", "-d", "postgres", "--data-only", "--format=custom",
    ...tables.map(t => `--table=${quoted(t.schema)}.${quoted(t.name)}`), `--file=${dump}`]);
  // Only the proven local fixture database is emptied; no hosted restore is allowed.
  // The local bootstrap superuser can disable FK triggers during data restoration;
  // the normal postgres role intentionally cannot alter managed Auth/Storage tables.
  docker(["psql", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c",
    "truncate " + tables.map(t => `${quoted(t.schema)}.${quoted(t.name)}`).join(",") + " cascade"]);
  docker(["pg_restore", "-U", "supabase_admin", "-d", "postgres", "--data-only", "--disable-triggers", "--no-owner", "--no-acl", "--exit-on-error", dump]);
  const after = await manifest();
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Restored records differ from the backup.");
  const invalid = await client.query("select count(*)::int n from (select org_id,user_id from public.wallet_ledger group by org_id,user_id having sum(amount)<0 union all select location_id,product_id from public.stock_movements group by location_id,product_id having sum(delta)<0) bad");
  if (invalid.rows[0].n) throw new Error("Restored stock/wallet invariant failed.");
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/restore-drill.json", JSON.stringify({ passed: true, tables: tables.length, orderRows: before["public.orders"].row_count, walletRows: before["public.wallet_ledger"].row_count }, null, 2));
  console.log(`Backup emptied and restored; ${tables.length} table checksums and stock/wallet invariants passed.`);
} finally {
  await client.end();
  docker(["rm", "-f", dump]);
}
