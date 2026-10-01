import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { pool, fixture, identity, placeOrder, expectDenied, type Fixture } from "./helpers";
let client: PoolClient, f: Fixture, order: string, amount: number;
beforeEach(async () => {
  client = await pool.connect(); await client.query("begin"); f = await fixture(client);
  const held = (await placeOrder(client, f, [1], [f.product], "card")).rows[0]; order = held.order_id; amount = Math.round(Number(held.total) * 100);
  await client.query("update public.orders set is_paid=true,status='placed',razorpay_payment_id='pay_refundtest' where id=$1", [order]);
});
afterEach(async () => { await client.query("rollback"); client.release(); });
afterAll(() => pool.end());
async function request() { return (await client.query("select public.request_order_refund($1) refund", [order])).rows[0].refund; }
it("paid cancellation releases stock once and cannot fake refund completion", async () => {
  await client.query("insert into public.wallet_ledger(org_id,user_id,amount,reason) values($1,$2,50,'earned'),($1,$2,-20,'redeemed')", [f.org, f.customer]);
  await client.query("update public.orders set user_id=$1,credit_used=20,total=total-20 where id=$2", [f.customer, order]);
  amount -= 2000;
  await identity(client, f.owner);
  await client.query("select public.cancel_order($1)", [order]); await client.query("select public.cancel_order($1)", [order]);
  expect((await client.query("select status from public.orders where id=$1", [order])).rows[0].status).toBe("refund_pending");
  expect((await client.query("select count(*)::int n from public.stock_movements where ref_id=$1 and reason='order_released'", [order])).rows[0].n).toBe(1);
  await client.query("reset role");
  expect((await client.query("select sum(amount)::int amount from public.wallet_ledger where org_id=$1 and user_id=$2", [f.org, f.customer])).rows[0].amount).toBe(50);
  await identity(client, f.owner);
  const a = await request(), b = await request(); expect(a.id).toBe(b.id); expect(a.amount).toBe(amount);
  expect((await client.query("select count(*)::int n from public.events where entity_id=$1 and event_type='order.refund_requested'", [order])).rows[0].n).toBe(1);
});
it("customers, other organizations and unassigned stores cannot request refunds", async () => {
  await client.query("update public.orders set status='cancelled' where id=$1", [order]);
  await client.query("update public.profiles set is_owner=true where id=$1", [f.outsider]);
  for (const user of [f.customer, f.outsider]) { await identity(client, user); await expectDenied(client, request); }
  await client.query("reset role");
  const otherStore = randomUUID();
  await client.query("insert into public.locations(id,org_id,type,name) values($1,$2,'store','Refund Other Store')", [otherStore, f.org]);
  await client.query("update public.memberships set location_id=$1 where user_id=$2", [otherStore, f.staff]);
  await identity(client, f.staff); await expectDenied(client, request);
});
it("rejects uncancelled orders and mismatched refund amounts without completing them", async () => {
  await identity(client, f.owner); await client.query("savepoint active_order");
  await expect(request()).rejects.toThrow("Cancel the paid order"); await client.query("rollback to savepoint active_order");
  await client.query("select public.cancel_order($1)", [order]); await request();
  await identity(client, f.owner, "service_role"); await client.query("savepoint mismatch");
  await expect(client.query("select public.record_order_refund('rfnd_test','pay_refundtest',$1,'processed')", [amount + 100])).rejects.toThrow("Refund mismatch");
  await client.query("rollback to savepoint mismatch");
  expect((await client.query("select status from public.orders where id=$1", [order])).rows[0].status).toBe("refund_pending");
});
it("only service verification finishes refunds, with monotonic idempotent events", async () => {
  await identity(client, f.owner); await client.query("select public.cancel_order($1)", [order]); await request();
  await expectDenied(client, () => client.query("select public.record_order_refund('rfnd_test','pay_refundtest',$1,'processed')", [amount]));
  await identity(client, f.owner, "service_role");
  await client.query("select public.record_order_refund('rfnd_test','pay_refundtest',$1,'pending')", [amount]);
  await client.query("select public.record_order_refund('rfnd_test','pay_refundtest',$1,'processed')", [amount]);
  await client.query("select public.record_order_refund('rfnd_test','pay_refundtest',$1,'processed')", [amount]);
  await client.query("select public.record_order_refund('rfnd_test','pay_refundtest',$1,'pending')", [amount]);
  expect((await client.query("select status from public.orders where id=$1", [order])).rows[0].status).toBe("cancelled");
  expect((await client.query("select count(*)::int n from public.events where entity_id=$1 and event_type='order.refund_processed'", [order])).rows[0].n).toBe(1);
});
