import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { pool, fixture, identity, placeOrder, expectDenied, type Fixture } from "./helpers";
let client: PoolClient, f: Fixture;
beforeEach(async () => { client = await pool.connect(); await client.query("begin"); f = await fixture(client); });
afterEach(async () => { await client.query("rollback"); client.release(); });
afterAll(() => pool.end());
describe("database authorization through actual roles", () => {
  it.each(["is_owner", "org_id"])("staff cannot edit profile security column %s", async column => {
    await identity(client, f.staff);
    const value = column === 'is_owner' ? true : f.otherOrg;
    await expectDenied(client, () => client.query(`update public.profiles set ${column}=$1 where id=$2`, [value,f.staff]));
  });
  it("staff can edit their own display name", async () => { await identity(client,f.staff); const result = await client.query("update public.profiles set full_name='CI Name' where id=$1 returning full_name",[f.staff]); expect(result.rows).toEqual([{ full_name:'CI Name' }]); });
  it("staff cannot change catalogue prices", async () => { await identity(client,f.staff); const result=await client.query("update public.products set sale_price=1 where id=$1 returning id",[f.product]); expect(result.rowCount).toBe(0); });
  it("owner can change their own catalogue", async () => { await identity(client,f.owner); const result=await client.query("update public.products set sale_price=150 where id=$1 returning id",[f.product]); expect(result.rowCount).toBe(1); });
  it("cross-tenant staff cannot read private profiles or orders", async () => { await placeOrder(client,f); await identity(client,f.outsider); expect((await client.query("select id from public.profiles where org_id=$1",[f.org])).rowCount).toBe(0); expect((await client.query("select id from public.orders where org_id=$1",[f.org])).rowCount).toBe(0); });
  it("staff cannot directly forge payment state", async () => { const placed=await placeOrder(client,f); await identity(client,f.staff); await expectDenied(client,()=>client.query("update public.orders set is_paid=true where id=$1",[placed.rows[0].order_id])); });
  it.each(['authenticated','anon'])("%s cannot invoke payment settlement", async role => { await identity(client,f.customer,role); await expectDenied(client,()=>client.query("select public.settle_razorpay_payment('ci-pay','ci-order',100,'payment.captured','{}')")); });
  it("customer cannot read another customer's wallet balance", async () => {
    await client.query("insert into public.wallet_ledger(org_id,user_id,amount,reason,ref) values($1,$2,20,'gift','CI-private')",[f.org,f.owner]);
    await identity(client,f.customer);
    await expectDenied(client,()=>client.query('select public.wallet_balance($1)',[f.owner]));
  });
  it("staff cannot bypass owner settings page through RPC", async () => {
    await identity(client,f.staff);
    await expectDenied(client,()=>client.query("select public.update_store_settings('Attacker',null,null,null,null,0,0,null,null,100,null)"));
  });
});
describe("checkout integrity", () => {
  it("aggregates duplicate lines and prices on server", async () => { const placed=await placeOrder(client,f,[2,3],[f.product,f.product]); const items=await client.query("select quantity,unit_price from public.order_items where order_id=$1",[placed.rows[0].order_id]); expect(items.rows).toEqual([{quantity:'5.000',unit_price:'100.00'}]); expect(Number(placed.rows[0].total)).toBe(500); });
  it.each([-1,0,51,null])("rejects mixed valid and invalid quantity %s with full rollback", async qty => {
    await client.query("savepoint invalid_checkout");
    let rejected=false;
    try { await placeOrder(client,f,[1,qty as number],[f.product,f.second]); } catch { rejected=true; }
    if (rejected) await client.query("rollback to savepoint invalid_checkout");
    expect(rejected, "Invalid line must reject entire basket before any stock movement").toBe(true);
    expect((await client.query("select count(*)::int n from public.orders where org_id=$1",[f.org])).rows[0].n).toBe(0);
    expect(Number((await client.query("select public.stock_available($1,$2) n",[f.location,f.second])).rows[0].n)).toBe(200);
  });
  it("rejects duplicate aggregate above limit", async () => { await expect(placeOrder(client,f,[30,30],[f.product,f.product])).rejects.toThrow(); });
  it("rejects unavailable products and insufficient stock", async () => { await expect(placeOrder(client,f,[1],['00000000-0000-0000-0000-000000000001'])).rejects.toThrow(); });
  it("rejects insufficient stock without creating order", async () => { await client.query("insert into public.stock_movements(org_id,location_id,product_id,delta,reason) values($1,$2,$3,-199,'adjustment')",[f.org,f.location,f.product]); await expect(placeOrder(client,f,[2])).rejects.toThrow(); });
  it("online checkout holds unpaid order and reserves exactly ordered stock", async () => { const placed=await placeOrder(client,f,[2],[f.product],'card'); const state=await client.query("select status,is_paid from public.orders where id=$1",[placed.rows[0].order_id]); expect(state.rows[0]).toEqual({status:'pending_payment',is_paid:false}); expect(Number((await client.query("select public.stock_available($1,$2) n",[f.location,f.product])).rows[0].n)).toBe(198); });
});
