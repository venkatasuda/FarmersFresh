import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool, fixture, identity, expectDenied, type Fixture } from "./helpers";

let client: PoolClient, f: Fixture;
beforeEach(async () => { client = await pool.connect(); await client.query("begin"); f = await fixture(client); });
afterEach(async () => { await client.query("rollback"); client.release(); });
afterAll(() => pool.end());

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
