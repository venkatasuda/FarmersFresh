import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { pool, fixture, placeOrder, type Fixture } from "./helpers";
let client: PoolClient, f: Fixture, id: string, amount: number;
beforeEach(async () => { client=await pool.connect(); await client.query('begin'); f=await fixture(client); const order=(await placeOrder(client,f,[2],[f.product],'card')).rows[0]; id=order.order_id; amount=Math.round(Number(order.total)*100); await client.query("update public.orders set razorpay_order_id=$1 where id=$2",['rp-'+id,id]); });
afterEach(async () => { await client.query('rollback'); client.release(); });
afterAll(()=>pool.end());
async function settle(payment='pay-'+id, paidAmount=amount) { return client.query("select public.settle_razorpay_payment($1,$2,$3,'payment.captured','{}') status",[payment,'rp-'+id,paidAmount]); }
describe('payment settlement invariants',()=>{
  it('settles once and replay does not duplicate paid event',async()=>{ expect((await settle()).rows[0].status).toBe('order_paid'); expect((await settle()).rows[0].status).toBe('duplicate'); expect((await client.query("select count(*)::int n from public.events where entity_id=$1 and event_type='order.paid'",[id])).rows[0].n).toBe(1); });
  it('wrong amount leaves order unpaid',async()=>{ expect((await settle('pay-'+id,1)).rows[0].status).toBe('amount_mismatch'); expect((await client.query('select is_paid from public.orders where id=$1',[id])).rows[0].is_paid).toBe(false); });
  it('missing amount cannot mark a payment paid',async()=>{ await client.query("select public.settle_razorpay_payment($1,$2,null,'payment.captured','{}')",['pay-'+id,'rp-'+id]); expect((await client.query('select is_paid from public.orders where id=$1',[id])).rows[0].is_paid).toBe(false); });
  it('payment after expiry cannot leave cancelled + paid state',async()=>{ await client.query("update public.orders set placed_at=now()-interval '31 minutes' where id=$1",[id]); await client.query('select public.cancel_stale_unpaid_orders()'); await settle(); const order=(await client.query('select status,is_paid from public.orders where id=$1',[id])).rows[0]; expect(order.status === 'cancelled' && order.is_paid, 'Late captured money needs explicit refund/reconciliation state').toBe(false); });
  it('paid order is never cancelled by stale cleanup',async()=>{ await settle(); await client.query("update public.orders set placed_at=now()-interval '31 minutes' where id=$1",[id]); await client.query('select public.cancel_stale_unpaid_orders()'); expect((await client.query('select status from public.orders where id=$1',[id])).rows[0].status).toBe('placed'); });
  it('immutable audit events reject updates and deletes',async()=>{ await settle(); await client.query('savepoint immutable'); await expect(client.query("delete from public.events where entity_id=$1",[id])).rejects.toThrow(); await client.query('rollback to savepoint immutable'); await expect(client.query("update public.events set event_type='forged' where entity_id=$1",[id])).rejects.toThrow(); });
});
