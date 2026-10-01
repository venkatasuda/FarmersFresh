import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool, fixture, identity, expectDenied, placeOrder, type Fixture } from "./helpers";

let client: PoolClient, f: Fixture;
beforeEach(async () => { client = await pool.connect(); await client.query("begin"); f = await fixture(client); });
afterEach(async () => { await client.query("rollback"); client.release(); });
afterAll(() => pool.end());

it("order history returns matching orders in newest-first order", async () => {
  await placeOrder(client, f);
  await client.query("update public.orders set contact_email=$1 where org_id=$2", [`${f.customer}@ci.invalid`, f.org]);
  await identity(client, f.customer);
  const result = (await client.query("select public.my_orders() result")).rows[0].result;
  expect(result).toHaveLength(1);
  expect(result[0].item_count).toBe(1);
  await identity(client, f.outsider);
  expect((await client.query("select public.my_orders() result")).rows[0].result).toEqual([]);
});

it("automatic delivery assignment can run twice in one transaction", async () => {
  await placeOrder(client, f);
  await client.query("update public.orders set status='confirmed' where org_id=$1", [f.org]);
  await client.query("update public.memberships set on_shift=true where user_id=$1", [f.staff]);
  await identity(client, f.owner);
  expect((await client.query("select public.auto_assign_deliveries() n")).rows[0].n).toBe(1);
  expect((await client.query("select public.auto_assign_deliveries() n")).rows[0].n).toBe(0);
  expect((await client.query("select assigned_to from public.orders where org_id=$1", [f.org])).rows[0].assigned_to).toBe(f.staff);
});

it("automatic reorder can retry with no demand and later create a draft", async () => {
  expect((await client.query("select public.auto_draft_reorder() n")).rows[0].n).toBe(0);
  expect((await client.query("select public.auto_draft_reorder() n")).rows[0].n).toBe(0);
  await client.query("insert into public.stock_movements(org_id,location_id,product_id,delta,reason) values($1,$2,$3,-200,'sale')", [f.org, f.location, f.product]);
  expect((await client.query("select public.auto_draft_reorder() n")).rows[0].n).toBe(1);
  expect((await client.query("select public.auto_draft_reorder() n")).rows[0].n).toBe(0);
  expect((await client.query("select qty_ordered from public.purchase_order_items where org_id=$1", [f.org])).rows[0].qty_ordered).toBe("64.300");
});

it("membership settlement requires the stored amount", async () => {
  const plan = (await client.query("insert into public.membership_plans(org_id,name,price,duration_days) values($1,'Test',100,30) returning id", [f.org])).rows[0].id;
  const gateway = `order_${randomUUID()}`;
  const id = (await client.query("insert into public.pass_memberships(org_id,user_id,plan_id,amount,razorpay_order_id) values($1,$2,$3,100,$4) returning id", [f.org, f.customer, plan, gateway])).rows[0].id;
  for (const amount of [null, 1]) {
    const result = await client.query("select public.settle_razorpay_payment($1,$2,$3,'payment.captured','{}') result", [`pay_${randomUUID()}`, gateway, amount]);
    expect(result.rows[0].result).toBe("amount_mismatch");
  }
  expect((await client.query("select status from public.pass_memberships where id=$1", [id])).rows[0].status).toBe("pending_payment");
  await client.query("select public.settle_razorpay_payment($1,$2,10000,'payment.captured','{}')", [`pay_${randomUUID()}`, gateway]);
  expect((await client.query("select status from public.pass_memberships where id=$1", [id])).rows[0].status).toBe("active");
});

it("rolls back all purchase-order rows when a later item is invalid", async () => {
  await identity(client, f.owner);
  const items = [{ productId: f.product, qty: 1, unitCost: 50 }, { productId: randomUUID(), qty: 1, unitCost: 50 }];
  await client.query("savepoint create_po");
  await expect(client.query("select public.create_purchase_order_with_items($1,null,'test',$2,true)", [f.location, JSON.stringify(items)])).rejects.toThrow();
  await client.query("rollback to savepoint create_po");
  expect((await client.query("select count(*)::int n from public.purchase_orders where org_id=$1", [f.org])).rows[0].n).toBe(0);
  const result = await client.query("select public.create_purchase_order_with_items($1,null,'test',$2,true) result", [f.location, JSON.stringify(items.slice(0, 1))]);
  expect((await client.query("select status from public.purchase_orders where id=$1", [result.rows[0].result.id])).rows[0].status).toBe("ordered");
});

it("an owner cannot create records in another organization's location", async () => {
  await identity(client, f.owner);
  expect((await client.query("select public.has_location($1) allowed", [f.otherLocation])).rows[0].allowed).toBe(false);
});

it("only the trusted server can consume request budgets", async () => {
  await identity(client, f.customer);
  await expectDenied(client, () => client.query("select public.consume_request_limit($1,2)", ["a".repeat(64)]));
  await identity(client, f.customer, "service_role");
  const key = randomUUID().replaceAll("-", "").repeat(2);
  const results = [];
  for (let i = 0; i < 3; i++) results.push((await client.query("select public.consume_request_limit($1,2) allowed", [key])).rows[0].allowed);
  expect(results).toEqual([true, true, false]);
});

it("direct uploads cannot bypass server content validation, even for owners", async () => {
  await identity(client, f.owner);
  await expectDenied(client, () => client.query("insert into storage.objects(bucket_id,name) values('product-images',$1)", [`${randomUUID()}.svg`]));
});

it("notification retries are delayed and stop at five attempts", async () => {
  const ids = [];
  for (const [attempts, minutes] of [[1, 6], [1, 1], [5, 20]]) {
    ids.push((await client.query("insert into public.notifications(org_id,channel,recipient,template,payload,status,attempts,claimed_at) values($1,'email','test@ci.invalid','test','{}','failed',$2,now()-$3*interval '1 minute') returning id", [f.org, attempts, minutes])).rows[0].id);
  }
  const claimed = (await client.query("select id from public.claim_notifications(100)")).rows.map(row => row.id);
  expect(claimed).toContain(ids[0]); expect(claimed).not.toContain(ids[1]); expect(claimed).not.toContain(ids[2]);
});
