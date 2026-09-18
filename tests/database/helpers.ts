import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL required: use a disposable local Supabase database.");
const url = new URL(connectionString);
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("Refusing database tests against a remote database.");
export const pool = new Pool({ connectionString, max: 12, statement_timeout: 15000 });
export async function identity(client: PoolClient, user: string, role = "authenticated") {
  if (!["authenticated", "anon", "service_role"].includes(role)) throw new Error("Invalid test role");
  await client.query(`set local role ${role}`);
  await client.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [user, JSON.stringify({ sub: user, role })]);
}
export async function fixture(client: PoolClient) {
  const org = randomUUID(), otherOrg = randomUUID(), location = randomUUID(), otherLocation = randomUUID();
  const owner = randomUUID(), staff = randomUUID(), outsider = randomUUID(), customer = randomUUID();
  const product = randomUUID(), second = randomUUID();
  await client.query("insert into auth.users(id,email) select id::uuid, id || '@ci.invalid' from unnest($1::text[]) id", [[owner, staff, outsider, customer]]);
  await client.query("insert into public.organizations(id,name,storefront_enabled,slug) values($1,'CI Shop',true,$3),($2,'Other Shop',false,$4)", [org, otherOrg, 'ci-'+org, 'ci-'+otherOrg]);
  await client.query("insert into public.locations(id,org_id,type,name) values($1,$2,'store','CI Store'),($3,$4,'store','Other Store')", [location, org, otherLocation, otherOrg]);
  await client.query("update public.organizations set storefront_location_id=$1 where id=$2", [location, org]);
  await client.query("insert into public.profiles(id,org_id,is_owner) values($1,$4,true),($2,$4,false),($3,$5,false)", [owner, staff, outsider, org, otherOrg]);
  await client.query("insert into public.memberships(org_id,user_id,location_id,role) values($1,$2,$3,'staff')", [org, staff, location]);
  await client.query("insert into public.products(id,org_id,name,slug,sale_price,is_published) values($1,$3,'CI A',$4,100,true),($2,$3,'CI B',$5,100,true)", [product, second, org, 'ci-'+product, 'ci-'+second]);
  await client.query("insert into public.stock_movements(org_id,location_id,product_id,delta,reason) values($1,$2,$3,200,'purchase'),($1,$2,$4,200,'purchase')", [org,location,product,second]);
  return { org, otherOrg, location, otherLocation, owner, staff, outsider, customer, product, second };
}
export type Fixture = Awaited<ReturnType<typeof fixture>>;
export async function placeOrder(client: PoolClient, f: Fixture, quantities = [1], products = [f.product], method = 'cod', options: {phone?: string; coupon?: string; useCredit?: boolean} = {}) {
  const lines = quantities.map((quantity, index) => ({ product_id: products[index], quantity }));
  return client.query(`select * from public.place_order($1,'CI Customer',$5,'CI Address','CI City','500001',null,null,null,
    array(select row(product_id,quantity)::public.cart_line from jsonb_to_recordset($2::jsonb) as x(product_id uuid, quantity numeric)),null,$4,$6,$3)`, [f.org, JSON.stringify(lines), method, options.coupon ?? null, options.phone ?? '9876543210', options.useCredit ?? false]);
}
export async function expectDenied(client: PoolClient, operation: () => Promise<unknown>) {
  await client.query("savepoint denial_check");
  let error: unknown;
  try { await operation(); } catch (caught) { error = caught; }
  await client.query("rollback to savepoint denial_check");
  if (!error) throw new Error("Expected authorization rejection; operation succeeded.");
  const dbError = error as { code?: string; message?: string };
  if (dbError.code !== '42501' && !/only.*owner|insufficient permission|not authorized|access denied/i.test(dbError.message ?? '')) throw error;
}
