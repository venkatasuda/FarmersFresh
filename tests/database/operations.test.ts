import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { pool, fixture, identity, placeOrder, expectDenied, type Fixture } from "./helpers";
let client: PoolClient, f: Fixture;
beforeEach(async () => { client = await pool.connect(); await client.query("begin"); f = await fixture(client); });
afterEach(async () => { await client.query("rollback"); client.release(); });
afterAll(() => pool.end());

it.each([
  ["manager", true, true, false],
  ["staff", true, false, false],
  ["accountant", false, false, true],
] as const)("%s has exactly the intended business capabilities", async (role, orders, inventory, finance) => {
  await client.query("update public.memberships set role=$1 where user_id=$2", [role, f.staff]);
  await identity(client, f.staff);
  const result = await client.query("select public.has_permission('orders.manage') orders,public.has_permission('inventory.adjust') inventory,public.has_permission('financials.read') finance,public.has_permission('settings.manage') settings");
  expect(result.rows[0]).toEqual({ orders, inventory, finance, settings: false });
  expect((await client.query("select public.has_location($1) own,public.has_location($2) other", [f.location, f.otherLocation])).rows[0]).toEqual({ own: true, other: false });
});

it("owners remain organization-scoped and customers gain no staff capability", async () => {
  await identity(client, f.owner);
  expect((await client.query("select public.has_permission('settings.manage') settings,public.has_location($1) other", [f.otherLocation])).rows[0]).toEqual({ settings: true, other: false });
  await identity(client, f.customer);
  expect((await client.query("select public.has_permission('orders.manage') allowed")).rows[0].allowed).toBe(false);
});

it("return reads and all return/refund actions enforce same-organization store boundaries", async () => {
  const otherStore = randomUUID(), ownReturn = randomUUID(), otherReturn = randomUUID();
  const ownOrder = (await placeOrder(client, f)).rows[0];
  await client.query("insert into public.locations(id,org_id,type,name) values($1,$2,'store','CI Second Store')", [otherStore, f.org]);
  await client.query("insert into public.stock_movements(org_id,location_id,product_id,delta,reason) values($1,$2,$3,10,'purchase')", [f.org, otherStore, f.product]);
  await client.query("update public.organizations set storefront_location_id=$1 where id=$2", [otherStore, f.org]);
  const otherOrder = (await placeOrder(client, f)).rows[0];
  await client.query("update public.orders set user_id=$1 where id=$2", [f.customer, otherOrder.order_id]);
  await client.query("insert into public.returns(id,org_id,order_id,order_number,user_id,reason) values($1,$3,$4,$5,$8,'CI'),($2,$3,$6,$7,$8,'CI')", [ownReturn, otherReturn, f.org, ownOrder.order_id, ownOrder.order_number, otherOrder.order_id, otherOrder.order_number, f.customer]);
  await identity(client, f.staff);
  expect((await client.query("select id from public.get_returns(true)")).rows).toEqual([{ id: ownReturn }]);
  expect((await client.query("select id from public.returns")).rows).toEqual([{ id: ownReturn }]);
  await expectDenied(client, () => client.query("select public.approve_return($1,20)", [otherReturn]));
  await expectDenied(client, () => client.query("select public.reject_return($1)", [otherReturn]));
  await expectDenied(client, () => client.query("select public.instant_refund($1,20,'CI')", [otherOrder.order_id]));
});

it("operations counters reflect business failures and are inaccessible to customer roles", async () => {
  const before = (await client.query("select * from public.operations_metrics()")).rows;
  await client.query("insert into public.notifications(org_id,channel,recipient,template,status) values($1,'email','ci@ci.invalid','order.placed','failed')", [f.org]);
  const after = (await client.query("select * from public.operations_metrics()")).rows;
  expect(Number(after.find(row => row.metric === "ff_failed_notifications_24h").value)).toBe(Number(before.find(row => row.metric === "ff_failed_notifications_24h").value) + 1);
  for (const role of ["authenticated", "anon"]) {
    await identity(client, f.customer, role);
    await expectDenied(client, () => client.query("select * from public.operations_metrics()"));
  }
});

it("portal monitoring counts only managed stores and rejects non-manager identities", async () => {
  const secondStore = randomUUID();
  const ownOrder = (await placeOrder(client, f)).rows[0];
  await client.query("insert into public.locations(id,org_id,type,name) values($1,$2,'store','Second store')", [secondStore, f.org]);
  await client.query("update public.organizations set storefront_location_id=$1 where id=$2", [secondStore, f.org]);
  await client.query("insert into public.stock_movements(org_id,location_id,product_id,delta,reason) values($1,$2,$3,200,'purchase')", [f.org, secondStore, f.product]);
  const otherOrder = (await placeOrder(client, f)).rows[0];
  await client.query("update public.orders set placed_at=now()-interval '25 hours' where id=any($1::uuid[])", [[ownOrder.order_id, otherOrder.order_id]]);
  await client.query("update public.memberships set role='manager' where user_id=$1", [f.staff]);
  // A second staff assignment must not expand a manager's monitoring scope.
  await client.query("insert into public.memberships(org_id,user_id,location_id,role) values($1,$2,$3,'staff')", [f.org, f.staff, secondStore]);
  await client.query("insert into public.notifications(org_id,channel,recipient,template,status,payload) values($1,'email','ci@ci.invalid','test','failed',jsonb_build_object('order_number',$2::text)),($1,'email','ci@ci.invalid','test','failed',jsonb_build_object('order_number',$3::text)),($1,'email','ci@ci.invalid','test','failed','{}')", [f.org, ownOrder.order_number, otherOrder.order_number]);
  await client.query("insert into public.payment_events(org_id,razorpay_payment_id,target_type,target_id,status) values($1,$2,'order',$3,'amount_mismatch'),($1,$4,'order',$5,'amount_mismatch')", [f.org, randomUUID(), ownOrder.order_id, randomUUID(), otherOrder.order_id]);
  const counts = async () => Object.fromEntries((await client.query("select * from public.portal_operations_metrics()")).rows.map(row => [row.metric, Number(row.value)]));
  await identity(client, f.staff);
  expect(await counts()).toMatchObject({ ff_stuck_orders: 1, ff_failed_notifications_24h: 1, ff_payment_exceptions_24h: 1, ff_low_stock_products: 0 });
  await identity(client, f.owner);
  expect(await counts()).toMatchObject({ ff_stuck_orders: 2, ff_failed_notifications_24h: 3, ff_payment_exceptions_24h: 2, ff_low_stock_products: 1 });
  await identity(client, f.outsider);
  await expectDenied(client, counts);
  await identity(client, f.customer);
  await expectDenied(client, counts);
  await identity(client, f.customer, 'anon');
  await expectDenied(client, counts);
  await client.query('reset role');
  await client.query("update public.memberships set role='staff' where user_id=$1", [f.staff]);
  await identity(client, f.staff);
  await expectDenied(client, counts);
});
