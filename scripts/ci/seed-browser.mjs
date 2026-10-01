#!/usr/bin/env node
// Synthetic catalogue for browser checkout; refuse remote or populated databases.
import pg from "pg";

const url = new URL(process.env.TEST_DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? "");
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
  throw new Error("Browser seed refuses a remote database.");
}
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  await client.query("begin");
  const { rows } = await client.query("select count(*)::int n from public.organizations");
  if (rows[0].n !== 0) throw new Error("Browser seed requires an empty disposable database.");
  const org = "11111111-1111-4111-8111-111111111111";
  const location = "22222222-2222-4222-8222-222222222222";
  const product = "33333333-3333-4333-8333-333333333333";
  await client.query("insert into public.organizations(id,name,slug,storefront_enabled,delivery_fee,free_delivery_threshold) values($1,'CI Shop','ci-shop',true,40,500)", [org]);
  await client.query("insert into public.locations(id,org_id,type,name) values($1,$2,'store','CI Store')", [location, org]);
  await client.query("update public.organizations set storefront_location_id=$1 where id=$2", [location, org]);
  await client.query("insert into public.products(id,org_id,name,slug,sale_price,is_published) values($1,$2,'CI Fresh Product','ci-fresh-product',100,true)", [product, org]);
  await client.query("insert into public.stock_movements(org_id,location_id,product_id,delta,reason) values($1,$2,$3,200,'purchase')", [org, location, product]);
  await client.query("commit");
  console.log("Seeded local browser catalogue and stock.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
