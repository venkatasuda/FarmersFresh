import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { pool, fixture, identity, placeOrder, expectDenied, type Fixture } from "./helpers";
let db: PoolClient, f: Fixture, order: string, total: number, today: string, yesterday: string;
beforeEach(async () => {
  db = await pool.connect(); await db.query("begin"); f = await fixture(db);
  const placed = (await placeOrder(db, f)).rows[0]; order = placed.order_id; total = Number(placed.total);
  await db.query("update public.orders set status='delivered',delivered_at=now() where id=$1", [order]);
  const dates = (await db.query("select to_char(clock_timestamp() at time zone 'Asia/Kolkata','YYYY-MM-DD') today,to_char((clock_timestamp() at time zone 'Asia/Kolkata')::date-1,'YYYY-MM-DD') yesterday")).rows[0];
  today = dates.today; yesterday = dates.yesterday;
});
afterEach(async () => { await db.query("rollback"); db.release(); });
afterAll(() => pool.end());
async function rejects(query: string, args: unknown[], pattern: RegExp) {
  await db.query("savepoint bad_cash"); await expect(db.query(query, args)).rejects.toThrow(pattern);
  await db.query("rollback to savepoint bad_cash");
}
const collect = () => db.query("select public.collect_cod($1,$2)", [order, total]);
async function summary() { return (await db.query("select public.cash_summary($1,$2) data", [f.location, today])).rows[0].data; }

it("collects COD once, audits it and excludes unpaid COD from collected-payment reports", async () => {
  await identity(db, f.owner);
  expect((await db.query("select public.sales_by_payment() data")).rows[0].data).toEqual([]);
  for (const amount of [total - 1, total + 1, NaN, Infinity, -1, null]) {
    await rejects("select public.collect_cod($1,$2)", [order, amount], /exact order total/);
  }
  await collect(); await collect();
  expect((await summary()).cod).toBe(total);
  expect((await summary()).outstanding_count).toBe(0);
  expect((await db.query("select public.sales_by_payment() data")).rows[0].data).toEqual([{ payment_method: "cod", orders: 1, revenue: total }]);
  await db.query("reset role");
  expect((await db.query("select is_paid,paid_at is not null dated from public.orders where id=$1", [order])).rows[0]).toEqual({ is_paid: true, dated: true });
  expect((await db.query("select count(*)::int n from public.events where entity_id=$1 and event_type='order.cod_collected'", [order])).rows[0].n).toBe(1);
  await rejects("update public.cod_receipts set amount=1 where order_id=$1", [order], /append-only/);
});

it("denies customers, other stores and accountants collection, and staff cannot close cash", async () => {
  for (const user of [f.customer, f.outsider]) {
    await identity(db, user); await expectDenied(db, collect);
    await expectDenied(db, summary);
  }
  await db.query("reset role");
  await db.query("update public.memberships set role='accountant' where user_id=$1", [f.staff]);
  await identity(db, f.staff); await expectDenied(db, collect);
  await db.query("reset role"); await db.query("update public.memberships set role='staff' where user_id=$1", [f.staff]);
  await identity(db, f.staff);
  await expectDenied(db, () => db.query("select public.close_cash_day($1,$2,0,0)", [f.location, yesterday]));
  await expectDenied(db, () => db.query("insert into public.cod_receipts(order_id,org_id,location_id,amount,collected_by) values($1,$2,$3,$4,$5)", [order, f.org, f.location, total, f.staff]));
  await expectDenied(db, () => db.query("select public.cash_summary($1,$2)", [f.otherLocation, today]));
  await identity(db, f.staff, "anon"); await expectDenied(db, collect);
});

it("refuses premature, cancelled, already-paid and non-COD orders", async () => {
  for (const [status, method, paid] of [["packed", "cod", false], ["cancelled", "cod", false], ["delivered", "card", false], ["delivered", "cod", true]]) {
    await db.query("reset role");
    await db.query("update public.orders set status=$2,payment_method=$3,is_paid=$4 where id=$1", [order, status, method, paid]);
    await identity(db, f.owner); await rejects("select public.collect_cod($1,$2)", [order, total], /Only unpaid delivered COD/);
  }
});

it("counts actual counter cash after wallet redemption and change, and never backdates payments", async () => {
  await db.query("insert into public.wallet_ledger(org_id,user_id,amount,reason) values($1,$2,30,'earned')", [f.org, f.customer]);
  await db.query("insert into public.wallet_ledger(org_id,user_id,amount,reason) values($1,$2,999,'earned')", [f.otherOrg, f.customer]);
  await db.query("insert into public.referrals(user_id,code) values($1,$2)", [f.customer, `CASH${f.customer.replaceAll('-', '')}`]);
  await identity(db, f.owner);
  expect((await db.query("select public.pos_loyalty_lookup($1) data", [`CASH${f.customer.replaceAll('-', '')}`])).rows[0].data.points).toBe(30);
  await db.query("select * from public.record_sale($1,null,array[row($2,1,100)::public.sale_line],'cash',100,null,$3,30)", [f.location, f.product, f.customer]);
  const data = await summary();
  expect(data.pos).toBe(70); expect(data.cod).toBe(0); expect(data.expected).toBe(70);
  await db.query("reset role");
  const payment = (await db.query("select id,created_at from public.payments where org_id=$1", [f.org])).rows[0];
  await rejects("update public.payments set amount=1 where id=$1", [payment.id], /append-only/);
  await db.query("insert into public.payments(org_id,location_id,amount,method,created_at) values($1,$2,1,'cash','2000-01-01')", [f.org, f.location]);
  expect((await db.query("select (created_at at time zone 'Asia/Kolkata')::date::text as business_date from public.payments where org_id=$1 order by created_at desc limit 1", [f.org])).rows[0].business_date).toBe(today);
});

it("closes completed IST days once with a variance note and stale-total protection", async () => {
  await db.query("insert into public.cod_receipts(order_id,org_id,location_id,amount,collected_by,collected_at) values($1,$2,$3,$4,$5,($6::date::timestamp at time zone 'Asia/Kolkata'))", [order, f.org, f.location, total, f.owner, yesterday]);
  await identity(db, f.owner);
  await rejects("select public.close_cash_day($1,$2,$3,$3)", [f.location, today, total], /completed business day/);
  await rejects("select public.close_cash_day($1,$2,0,0)", [f.location, yesterday], /totals changed/);
  await rejects("select public.close_cash_day($1,$2,$3,0)", [f.location, yesterday, total], /Explain/);
  await rejects("select public.close_cash_day($1,$2,$3,'NaN')", [f.location, yesterday, total], /valid cash amount/);
  const close = () => db.query("select public.close_cash_day($1,$2,$3,$4,'Shortage investigated') id", [f.location, yesterday, total, total - 10]);
  const id = (await close()).rows[0].id; expect((await close()).rows[0].id).toBe(id);
  await rejects("select public.close_cash_day($1,$2,$3,$3)", [f.location, yesterday, total], /already closed/);
  const data = (await db.query("select public.cash_summary($1,$2) data", [f.location, yesterday])).rows[0].data;
  expect(data.closing).toMatchObject({ expected: total, counted: total - 10, difference: -10 });
  await db.query("reset role");
  expect((await db.query("select count(*)::int n from public.events where entity_id=$1 and event_type='cash.day_closed'", [id])).rows[0].n).toBe(1);
  await rejects("delete from public.cash_closings where id=$1", [id], /append-only/);
});
