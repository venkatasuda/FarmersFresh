import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool, fixture, identity, placeOrder, expectDenied, type Fixture } from "./helpers";
let db: PoolClient, f: Fixture, order: string, total: number, ret: string, shift: string;
beforeEach(async () => {
  db = await pool.connect(); await db.query("begin"); f = await fixture(db);
  const placed = (await placeOrder(db, f)).rows[0]; order = placed.order_id; total = Number(placed.total);
  ret = randomUUID(); shift = randomUUID();
  await db.query("update public.orders set status='delivered',delivered_at=now(),user_id=$2 where id=$1", [order, f.customer]);
  await db.query("insert into public.returns(id,org_id,order_id,order_number,user_id,reason) select $1,org_id,id,order_number,user_id,'Damaged goods' from public.orders where id=$2", [ret, order]);
});
afterEach(async () => { await db.query("rollback"); db.release(); });
afterAll(() => pool.end());
async function rejects(sql: string, args: unknown[], pattern: RegExp) {
  await db.query("savepoint cash_bad"); await expect(db.query(sql,args)).rejects.toThrow(pattern); await db.query("rollback to savepoint cash_bad");
}
const refund = () => db.query("select public.refund_return_cash($1,20,'Damaged goods refunded')", [ret]);
const open = () => db.query("select public.open_cash_shift($1,$2,100)", [shift,f.location]);
async function active() { return (await db.query("select public.cash_shift_summary($1) data",[f.location])).rows[0].data.active; }
it("refunds collected COD once, subtracts till cash and blocks wallet compensation through both entry points", async () => {
  await identity(db,f.owner); await open(); await open();
  await rejects("select public.refund_return_cash($1,20,'Damaged goods')",[ret],/Only collected COD/);
  await db.query("select public.collect_cod($1,$2)",[order,total]);
  await refund(); await refund();
  expect(await active()).toMatchObject({opening:100,receipts:total,refunds:20,expected:100+total-20});
  await rejects("select public.instant_refund($1,5,'Again')",[order],/already has a cash refund/);
  await db.query("reset role");
  const second = randomUUID();
  await db.query("insert into public.returns(id,org_id,order_id,order_number,user_id,reason) select $1,org_id,id,order_number,user_id,'Second return' from public.orders where id=$2",[second,order]);
  await identity(db,f.owner);
  await rejects("select public.approve_return($1,5)",[second],/already has a cash refund/);
  await rejects("select public.refund_return_cash($1,$2,'Over refund')",[second,total],/exceeds collected/);
  await rejects("select public.refund_return_cash($1,21,'Changed')",[ret],/already has a cash refund/);
  await db.query("reset role");
  expect((await db.query("select count(*)::int n from public.cash_refunds where order_id=$1",[order])).rows[0].n).toBe(1);
  expect((await db.query("select count(*)::int n from public.events where entity_id=$1 and event_type='return.cash_refunded'",[ret])).rows[0].n).toBe(1);
  await rejects("delete from public.cash_refunds where return_id=$1",[ret],/append-only/);
});
it("blocks cash after wallet refunds, validates amounts and supports guests", async () => {
  await identity(db,f.owner); await db.query("select public.collect_cod($1,$2)",[order,total]);
  await db.query("select public.instant_refund($1,5,'Damaged')",[order]);
  await rejects("select public.refund_return_cash($1,20,'Damaged')",[ret],/wallet refund/);
  await db.query("reset role");
  await db.query("update public.orders set user_id=null where id=$1",[order]);
  await db.query("update public.returns set user_id=null where id=$1",[ret]);
  // A separate guest order has no wallet compensation.
  const guest=(await placeOrder(db,f)).rows[0];
  await db.query("update public.orders set status='delivered' where id=$1",[guest.order_id]);
  const guestReturn=randomUUID();
  await db.query("insert into public.returns(id,org_id,order_id,order_number,reason) values($1,$2,$3,$4,'Guest damage')",[guestReturn,f.org,guest.order_id,guest.order_number]);
  await identity(db,f.owner); await db.query("select public.collect_cod($1,$2)",[guest.order_id,guest.total]);
  for(const value of [NaN,Infinity,-1,0,1.001,null]) await rejects("select public.refund_return_cash($1,$2,'Reason')",[guestReturn,value],/valid cash amount/);
  await rejects("select public.refund_return_cash($1,10,'')",[guestReturn],/refund reason/);
  await db.query("select public.refund_return_cash($1,10,'Guest cash returned')",[guestReturn]);
});
it("closes a shift once with stale-total and variance protection; the next shift excludes earlier receipts", async () => {
  await identity(db,f.owner); await open();
  await rejects("select public.open_cash_shift($1,$2,0)",[randomUUID(),f.location],/active till/);
  await db.query("select public.collect_cod($1,$2)",[order,total]);
  await rejects("select public.close_cash_shift($1,100,100,'')",[shift],/totals changed/);
  await rejects("select public.close_cash_shift($1,$2,0,'')",[shift,100+total],/Explain/);
  const close=()=>db.query("select public.close_cash_shift($1,$2,$2,'')",[shift,100+total]);
  await close(); await close();
  expect(await active()).toBeNull();
  await rejects("select public.close_cash_shift($1,$2,0,'Changed')",[shift,100+total],/already closed/);
  await db.query("select public.open_cash_shift($1,$2,50)",[randomUUID(),f.location]);
  expect(await active()).toMatchObject({opening:50,expected:50,receipts:0,refunds:0});
  await db.query("reset role");
  expect((await db.query("select count(*)::int n from public.events where entity_id=$1",[shift])).rows[0].n).toBe(2);
});
it("denies staff, customers, other stores, anonymous calls and direct client ledger edits", async () => {
  for(const user of [f.staff,f.customer,f.outsider]) {
    await identity(db,user); await expectDenied(db,open); await expectDenied(db,refund);
  }
  await identity(db,f.owner,"anon"); await expectDenied(db,open);
  await db.query("reset role");
  await db.query("update public.memberships set role='accountant' where user_id=$1",[f.staff]);
  await identity(db,f.staff); await open();
  await expectDenied(db,()=>db.query("select public.cash_shift_summary($1)",[f.otherLocation]));
  await rejects("update public.cash_shifts set opening=0 where id=$1",[shift],/permission denied/);
  await identity(db,f.customer);
  expect((await db.query("select * from public.cash_shifts")).rows).toEqual([]);
});
