// Explicitly authorized demo only. Keys arrive through stdin and are never logged.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const project = "bjevoybwufubtprkxbvb";
assert.equal(process.argv[2], "--confirmed-demo", "Requires explicit demo acknowledgement");
const npm = "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js";
const providerSecrets = JSON.parse(execFileSync(process.execPath, [npm, "exec", "--yes", "--package=supabase", "--",
  "supabase", "secrets", "list", "--project-ref", project, "--output", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
assert(!providerSecrets.some(s => ["RESEND_API_KEY", "MSG91_AUTHKEY", "WHATSAPP_TOKEN", "VAPID_PRIVATE_KEY"].includes(s.name)),
  "Demo order checks refuse configured delivery providers");
const keys = JSON.parse(readFileSync(0, "utf8"));
const secret = keys.find(k => k.name === "service_role")?.api_key;
const anon = keys.find(k => k.name === "anon")?.api_key;
assert(secret && anon, "Demo credentials missing");
const settings = { auth: { persistSession: false, autoRefreshToken: false } };
const url = `https://${project}.supabase.co`;
const admin = createClient(url, secret, settings), guest = createClient(url, anon, settings);
const org = randomUUID(), product = randomUUID(), stores = [randomUUID(), randomUUID()];
const accounts = [], orders = [];
let organizationCreated = false;
function check(result) { assert(!result.error, "Demo database operation failed"); return result.data; }
async function account(owner) {
  const password = randomUUID() + randomUUID();
  const user = check(await admin.auth.admin.createUser({ email: `rehearsal-${randomUUID()}@example.invalid`, password, email_confirm: true })).user;
  accounts.push(user.id);
  check(await admin.from("profiles").insert({ id: user.id, org_id: org, is_owner: owner }));
  const client = createClient(url, anon, settings);
  check(await client.auth.signInWithPassword({ email: user.email, password }));
  return { client, id: user.id };
}
async function place(phone) {
  const result = check(await guest.rpc("place_order", { p_org_id: org, p_contact_name: "Demo Rehearsal",
    p_contact_phone: phone, p_address_line: "Synthetic demo address", p_city: "Demo", p_pincode: "500001",
    p_landmark: null, p_delivery_slot: null, p_notes: "LAUNCH_REHEARSAL", p_contact_email: null,
    p_lines: [{ product_id: product, quantity: 1 }], p_coupon_code: null, p_use_credit: false, p_payment_method: "cod" }))[0];
  orders.push(result.order_id);
  assert.equal(Number(result.total), 140);
  return result.order_id;
}
try {
  check(await admin.from("organizations").insert({ id: org, name: "DEMO Launch Rehearsal", slug: "rehearsal-" + org,
    storefront_enabled: false, delivery_fee: 40, free_delivery_threshold: 500 }));
  organizationCreated = true;
  check(await admin.from("locations").insert(stores.map((id, i) => ({ id, org_id: org, type: "store", name: "Demo Store " + i }))));
  check(await admin.from("products").insert({ id: product, org_id: org, name: "Demo Rehearsal Product", slug: "rehearsal-" + product, sale_price: 100, is_published: true }));
  const owner = await account(true), staff = await account(false);
  check(await admin.from("memberships").insert({ org_id: org, user_id: staff.id, location_id: stores[0], role: "staff" }));
  for (const location of stores) check(await owner.client.rpc("record_stock", { p_location: location, p_product: product,
    p_delta: 20, p_reason: "purchase", p_note: "LAUNCH_REHEARSAL" }));
  check(await admin.from("organizations").update({ storefront_enabled: true, storefront_location_id: stores[0] }).eq("id", org));
  const delivered = await place("9000000000"), cancelled = await place("9000000001");
  for (const status of ["confirmed", "packed", "out_for_delivery", "delivered"])
    check(await staff.client.rpc("set_order_status", { p_order_id: delivered, p_to: status }));
  for (let retry = 0; retry < 2; retry++) check(await staff.client.rpc("cancel_order", { p_order_id: cancelled, p_reason: "Demo retry" }));
  check(await admin.from("organizations").update({ storefront_location_id: stores[1] }).eq("id", org));
  const otherStore = await place("9000000002");
  assert.deepEqual(check(await staff.client.from("orders").select("id").eq("id", otherStore)), [], "Other store read must be hidden");
  for (const [name, args] of [["set_order_status", { p_order_id: otherStore, p_to: "confirmed" }],
    ["cancel_order", { p_order_id: otherStore, p_reason: "Denied" }]]) {
    const rejected = await staff.client.rpc(name, args);
    assert.equal(rejected.error?.code, "42501", "Other store write must be rejected by authorization");
  }
  const customerDenied = await guest.rpc("set_order_status", { p_order_id: delivered, p_to: "confirmed" });
  assert.equal(customerDenied.error?.code, "42501", "Anonymous staff action must be rejected");
  check(await owner.client.rpc("cancel_order", { p_order_id: otherStore, p_reason: "Demo cleanup" }));
  const states = check(await admin.from("orders").select("id,status,is_paid").in("id", orders));
  assert.equal(states.find(o => o.id === delivered).status, "delivered");
  assert.equal(states.filter(o => o.status === "cancelled").length, 2);
  const movements = check(await admin.from("stock_movements").select("location_id,delta,reason").eq("org_id", org));
  for (let i = 0; i < stores.length; i++) assert.equal(movements.filter(m => m.location_id === stores[i]).reduce((n, m) => n + Number(m.delta), 0), i === 0 ? 19 : 20);
  assert.equal(movements.filter(m => m.reason === "order_released").length, 2, "Repeated cancellation releases stock once");
  const events = check(await admin.from("events").select("event_type").eq("org_id", org));
  assert.equal(events.filter(e => e.event_type === "order.placed").length, 3);
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/demo-orders.json", JSON.stringify({ project, organization: org, orders, passed: true,
    fulfilled: 1, cancelled: 2, stockConserved: true, storeReadDenied: true, storeWritesDenied: true,
    anonymousDenied: true, scope: "hosted backend RPC; staff UI sign-off still required" }, null, 2));
  console.log("Hosted COD fulfillment, cancellation retries, stock, audit and store authorization passed.");
} finally {
  // Preserve append-only ledger evidence; hide the fixture and disable its accounts.
  if (organizationCreated) check(await admin.from("organizations").update({ storefront_enabled: false }).eq("id", org));
  for (const user of accounts) check(await admin.auth.admin.updateUserById(user, { ban_duration: "876000h" }));
  console.log("Demo organization hidden; synthetic accounts disabled. Audit history retained.");
}
