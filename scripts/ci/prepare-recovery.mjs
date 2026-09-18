// Recovery test environment ONLY. This is not a replacement migration chain.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, rmSync } from "node:fs";
const directory = ".ci-recovery/supabase";
rmSync(`${directory}/migrations`, { recursive: true, force: true });
mkdirSync(`${directory}/migrations`, { recursive: true });
copyFileSync("supabase/config.toml", `${directory}/config.toml`);
let sql = readFileSync("supabase/schema_snapshot.sql", "utf8");
// pg_dump psql meta commands cannot be sent as SQL by the CLI migration runner.
sql = sql.split("\n").filter(line => !line.startsWith("\\restrict") && !line.startsWith("\\unrestrict")).join("\n");
sql = sql.replace("CREATE SCHEMA public;", "CREATE SCHEMA IF NOT EXISTS public;");
writeFileSync(`${directory}/migrations/00000000000000_recovery_snapshot.sql`, sql);
console.log("Prepared isolated schema-snapshot test environment; historical migration gate remains mandatory.");

const metadata=JSON.parse(readFileSync("supabase/schema_snapshot.meta.json","utf8"));
if(!existsMigration(metadata.last_included_migration))throw new Error("Snapshot migration boundary is missing");
function existsMigration(name) { return readdirSync("supabase/migrations").includes(name); }
for(const name of readdirSync("supabase/migrations").filter(name=>name.endsWith(".sql") && name>metadata.last_included_migration).sort()) {
  copyFileSync(`supabase/migrations/${name}`,`${directory}/migrations/${name}`);
  console.log(`Included post-snapshot migration: ${name}`);
}
