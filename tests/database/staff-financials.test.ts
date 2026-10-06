import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { pool, fixture, identity, placeOrder, expectDenied, type Fixture } from "./helpers";

let client: PoolClient, f: Fixture;
beforeEach(async () => { client = await pool.connect(); await client.query("begin"); f = await fixture(client); });
afterEach(async () => { await client.query("rollback"); client.release(); });
afterAll(() => pool.end());

it("binds every financial report to finance assignments, including mixed roles and revocation", async () => {
  const secondStore = randomUUID(), hiddenProduct = randomUUID();
  await client.query("update public.products set last_cost=99 where id=$1", [f.product]);
  const own = (await placeOrder(client, f)).rows[0];
  await client.query("insert into public.locations(id,org_id,type,name) values($1,$2,'store','Second store')", [secondStore, f.org]);
  await client.query("insert into public.products(id,org_id,name,slug,sale_price,last_cost,is_published) values($1,$2,'Hidden store product',$3,200,199,true)", [hiddenProduct, f.org, 'ci-'+hiddenProduct]);
  await client.query("insert into public.stock_movements(org_id,location_id,product_id,delta,reason) values($1,$2,$3,200,'purchase')", [f.org, secondStore, hiddenProduct]);
  await client.query("update public.organizations set storefront_location_id=$1 where id=$2", [secondStore, f.org]);
  const hidden = (await placeOrder(client, f, [1], [hiddenProduct])).rows[0];
  await client.query("update public.memberships set role='accountant' where user_id=$1", [f.staff]);
  await client.query("insert into public.memberships(org_id,user_id,location_id,role) values($1,$2,$3,'manager')", [f.org, f.staff, secondStore]);
  const paymentIds = [randomUUID(), randomUUID(), randomUUID()];
  await client.query("insert into public.payment_events(org_id,razorpay_payment_id,target_type,target_id,status,amount) values($1,$2,'order',$3,'amount_mismatch',100),($1,$4,'order',$5,'amount_mismatch',200),($1,$6,'membership',$7,'amount_mismatch',300)", [f.org, paymentIds[0], own.order_id, paymentIds[1], hidden.order_id, paymentIds[2], randomUUID()]);
  const read = async (fn: string) => (await client.query(`select public.${fn}() data`)).rows[0].data;
  await identity(client, f.staff);
  expect(await read('financial_report_locations')).toEqual([f.location]);
  expect(await read('financials_overview')).toMatchObject({ revenue: 100, order_count: 1 });
  expect(await read('margin_by_product')).toMatchObject([{ product_name: 'CI A', revenue: 100 }]);
  // Payment totals include the configured delivery fee; product revenue does not.
  expect(await read('sales_by_payment')).toMatchObject([{ revenue: Number(own.total), orders: 1 }]);
  expect(await read('price_check')).toMatchObject([{ product_name: 'CI A' }]);
  expect((await read('payment_reconciliation')).map((row: { payment_id: string }) => row.payment_id)).toEqual([paymentIds[0]]);
  await expectDenied(client, () => read('business_overview'));
  await identity(client, f.owner);
  expect(await read('financial_report_locations')).not.toContain(f.otherLocation);
  expect(await read('financials_overview')).toMatchObject({ revenue: 300, order_count: 2 });
  expect(await read('margin_by_product')).toHaveLength(2);
  expect(await read('price_check')).toHaveLength(2);
  expect(await read('payment_reconciliation')).toHaveLength(3);
  await client.query('reset role');
  await client.query("delete from public.memberships where user_id=$1 and role='accountant'", [f.staff]);
  await identity(client, f.staff);
  await expectDenied(client, () => read('financials_overview'));
});

it("denies finance RPCs to ordinary staff, managers, customers, outsiders and anonymous users", async () => {
  const reports = ['financial_report_locations', 'financials_overview', 'margin_by_product', 'sales_by_payment', 'price_check', 'payment_reconciliation', 'business_overview'];
  for (const user of [f.staff, f.customer, f.outsider]) {
    await identity(client, user);
    for (const fn of reports) await expectDenied(client, () => client.query(`select public.${fn}()`));
  }
  await client.query('reset role');
  await client.query("update public.memberships set role='manager' where user_id=$1", [f.staff]);
  await identity(client, f.staff);
  for (const fn of reports) await expectDenied(client, () => client.query(`select public.${fn}()`));
  await identity(client, f.customer, 'anon');
  for (const fn of reports) await expectDenied(client, () => client.query(`select public.${fn}()`));
  await client.query('reset role');
  await client.query("insert into public.memberships(org_id,user_id,location_id,role) values($1,$2,$3,'accountant')", [f.otherOrg, f.outsider, f.otherLocation]);
  await identity(client, f.outsider);
  expect((await client.query("select public.financial_report_locations() locations,public.financials_overview() report")).rows[0]).toMatchObject({ locations: [f.otherLocation], report: { revenue: 0, order_count: 0 } });
});
