// Write-heavy backend API baseline, exclusively against the disposable CI stack.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

const database = new URL(process.env.TEST_DATABASE_URL || "https://invalid");
const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert(process.env.CI === "true" && ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) &&
  database.port === "54322" && database.pathname === "/postgres", "Requires the disposable CI database");
assert.match(api || "", /^http:\/\/(localhost|127\.0\.0\.1):54321$/);
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(anon && service, "Local credentials missing");
const db = new Client({ connectionString: database.toString() });
const admin = createClient(api, service, { auth: { persistSession: false } });
const owner = createClient(api, anon, { auth: { persistSession: false } });
const org = randomUUID(), location = randomUUID(), password = randomUUID() + randomUUID();
const products = Array.from({ length: 20 }, () => randomUUID());
const timings = [], requests = 120, concurrency = 12;
let next = 0;
async function rpc(name, body, token = anon) {
  const started = performance.now();
  const response = await fetch(`${api}/rest/v1/rpc/${name}`, {
    method: "POST", headers: { apikey: anon, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
  });
  timings.push(performance.now() - started);
  assert(response.ok, `Backend ${name} failed with HTTP ${response.status}`);
  const text = await response.text(); return text ? JSON.parse(text) : null;
}
await db.connect();
try {
  const identity = await admin.auth.admin.createUser({ email: `load-${org}@example.invalid`, password, email_confirm: true });
  assert(!identity.error && identity.data.user, "Local owner creation failed");
  const user = identity.data.user.id;
  const session = await owner.auth.signInWithPassword({ email: identity.data.user.email, password });
  assert(!session.error && session.data.session, "Local owner sign-in failed");
  const token = session.data.session.access_token;
  await db.query("begin");
  await db.query("insert into public.organizations(id,name,slug,storefront_enabled,delivery_fee,free_delivery_threshold) values($1,'CI Checkout Load',$2,true,40,500)", [org, "load-" + org]);
  await db.query("insert into public.locations(id,org_id,type,name) values($1,$2,'store','Load Store')", [location, org]);
  await db.query("update public.organizations set storefront_location_id=$1 where id=$2", [location, org]);
  await db.query("insert into public.profiles(id,org_id,is_owner) values($1,$2,true)", [user, org]);
  for (let i = 0; i < products.length; i++) {
    await db.query("insert into public.products(id,org_id,name,slug,sale_price,is_published) values($1,$2,$3,$4,$5,true)", [products[i], org, "Load Product " + i, "load-" + products[i], 100 + i]);
    await db.query("insert into public.stock_movements(org_id,location_id,product_id,delta,reason) values($1,$2,$3,200,'purchase')", [org, location, products[i]]);
  }
  await db.query("commit");
  const started = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < requests) {
      const index = next++;
      const placed = await rpc("place_order", { p_org_id: org, p_contact_name: "CI Load Customer",
        p_contact_phone: "9" + String(index).padStart(9, "0"), p_contact_email: null,
        p_address_line: "Synthetic CI Address", p_city: "CI City", p_pincode: "500001", p_landmark: null,
        p_delivery_slot: null, p_notes: null, p_lines: [{ product_id: products[index % 20], quantity: 1 }],
        p_coupon_code: null, p_use_credit: false, p_payment_method: "cod" });
      assert.equal(Number(placed[0].total), 140 + index % 20, "Authoritative catalogue price and delivery fee");
      const order = placed[0].order_id;
      if (index % 2 === 0) {
        // Repeat cancellation simulates a staff retry after an ambiguous response.
        for (let retry = 0; retry < 2; retry++) await rpc("cancel_order", { p_order_id: order, p_reason: "CI cancellation" }, token);
      } else {
        for (const status of ["confirmed", "packed", "out_for_delivery", "delivered"])
          await rpc("set_order_status", { p_order_id: order, p_to: status }, token);
      }
    }
  }));
  const elapsed = performance.now() - started;
  const states = (await db.query("select status,count(*)::int n from public.orders where org_id=$1 group by status order by status", [org])).rows;
  assert.deepEqual(states, [{ status: "cancelled", n: 60 }, { status: "delivered", n: 60 }]);
  const stock = (await db.query("select product_id,sum(delta)::int n from public.stock_movements where org_id=$1 group by product_id", [org])).rows;
  assert.equal(stock.length, products.length);
  for (const row of stock) assert.equal(row.n, products.indexOf(row.product_id) % 2 === 0 ? 200 : 194, "Reservations and releases conserve stock");
  assert.equal((await db.query("select count(*)::int n from public.stock_movements where org_id=$1 and reason='order_released'", [org])).rows[0].n, 60);
  assert.equal((await db.query("select count(*)::int n from public.events where org_id=$1 and event_type='order.placed'", [org])).rows[0].n, requests);
  timings.sort((a, b) => a - b);
  const p95 = timings[Math.ceil(timings.length * 0.95) - 1];
  assert(p95 < 2000, `Backend write latency p95 ${Math.round(p95)}ms exceeds the 2000ms CI budget`);
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/checkout-load.json", JSON.stringify({ scope: "local backend RPC, not production capacity", concurrency,
    orders: requests, apiRequests: timings.length, durationMs: Math.round(elapsed), p95Ms: Math.round(p95),
    ordersPerSecond: Number((requests * 1000 / elapsed).toFixed(2)), cancelled: 60, delivered: 60, stockVerified: true }, null, 2));
  console.log(`Backend checkout load passed: ${requests} orders, ${timings.length} API requests, p95 ${Math.round(p95)}ms, stock conserved.`);
} finally { await db.end(); }
