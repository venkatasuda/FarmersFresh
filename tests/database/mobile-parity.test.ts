import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { pool, fixture, identity, placeOrder, expectDenied, type Fixture } from "./helpers";

// Rules that must hold for EVERY client (website, future mobile app, raw API calls),
// so they are enforced by the database rather than by the Next.js server actions.
let client: PoolClient, f: Fixture;
beforeEach(async () => { client = await pool.connect(); await client.query("begin"); f = await fixture(client); });
afterEach(async () => { await client.query("rollback"); client.release(); });
afterAll(() => pool.end());

async function rejects(fn: () => Promise<unknown>, message: RegExp) {
  await client.query("savepoint s");
  await expect(fn()).rejects.toThrow(message);
  await client.query("rollback to savepoint s");
}
const setStatus = (id: string, to: string) => client.query("select public.set_order_status($1,$2)", [id, to]);
const status = async (id: string) => (await client.query("select status from public.orders where id=$1", [id])).rows[0].status;

describe("order status changes go through set_order_status", () => {
  it("staff cannot write orders.status directly", async () => {
    const id = (await placeOrder(client, f)).rows[0].order_id;
    await identity(client, f.staff);
    await expectDenied(client, () => client.query("update public.orders set status='delivered' where id=$1", [id]));
  });

  it("moves forward only, and sets confirmed_at / delivered_at", async () => {
    const id = (await placeOrder(client, f)).rows[0].order_id;
    await identity(client, f.staff);
    await setStatus(id, "confirmed");
    await rejects(() => setStatus(id, "placed"), /can't be moved/);
    await setStatus(id, "delivered");
    const row = (await client.query("select status, confirmed_at is not null c, delivered_at is not null d from public.orders where id=$1", [id])).rows[0];
    expect(row).toEqual({ status: "delivered", c: true, d: true });
  });

  it("an unpaid online order cannot be marked delivered", async () => {
    const id = (await placeOrder(client, f, [1], [f.product], "card")).rows[0].order_id;
    await identity(client, f.staff);
    await rejects(() => setStatus(id, "delivered"), /pending payment/);
    expect(await status(id)).toBe("pending_payment");
  });

  it("cannot cancel through it (cancel_order returns the stock)", async () => {
    const id = (await placeOrder(client, f)).rows[0].order_id;
    await identity(client, f.staff);
    await rejects(() => setStatus(id, "cancelled"), /can't be moved/);
  });

  it("staff from another org cannot move the order", async () => {
    const id = (await placeOrder(client, f)).rows[0].order_id;
    await identity(client, f.outsider);
    await expectDenied(client, () => setStatus(id, "confirmed"));
  });
});

describe("subscriptions are created through create_subscription", () => {
  it("customers cannot insert subscriptions directly", async () => {
    await identity(client, f.customer);
    await expectDenied(client, () => client.query(
      `insert into public.subscriptions(org_id,user_id,product_id,quantity,frequency,next_run,contact_name,contact_phone,address_line)
       values($1,$2,$3,1,'weekly',current_date,'x','9876543210','a')`, [f.org, f.customer, f.product]));
  });

  it("validates input and uses the saved address", async () => {
    // storefront_org_id() serves one shop; keep this test's shop the open one.
    await client.query("update public.organizations set storefront_enabled=(id=$1)", [f.org]);
    await client.query("insert into public.customer_addresses(user_id,address_line,contact_name,contact_phone,is_default) values($1,'1 CI Road','CI','9876543210',true)", [f.customer]);
    await identity(client, f.customer);
    const bad = (await client.query("select public.create_subscription($1,0,'weekly') r", [f.product])).rows[0].r;
    expect(bad.ok).toBe(false);
    const good = (await client.query("select public.create_subscription($1,1,'weekly') r", [f.product])).rows[0].r;
    expect(good, JSON.stringify(good)).toEqual({ ok: true });
    const row = (await client.query("select address_line, next_run = current_date + 1 tomorrow from public.subscriptions where user_id=$1", [f.customer])).rows[0];
    expect(row).toEqual({ address_line: "1 CI Road", tomorrow: true });
  });
});
