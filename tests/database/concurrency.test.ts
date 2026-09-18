import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool, fixture, identity, placeOrder } from "./helpers";
afterAll(()=>pool.end());
async function waitForBlocked(pids: number[]) {
  // Poll real lock state instead of relying on a race won by a lucky sleep.
  const deadline=Date.now()+8000;
  while (Date.now()<deadline) {
    const result=await pool.query("select count(*)::int n from pg_stat_activity where pid=any($1::int[]) and wait_event_type='Lock'",[pids]);
    if (result.rows[0].n===pids.length) return;
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  throw new Error('Concurrent calls did not reach the expected lock barrier');
}
async function pid(client:PoolClient) { return (await client.query('select pg_backend_pid() pid')).rows[0].pid as number; }
describe('deterministic multi-session concurrency',()=>{
  it('simultaneous gift-card claims award exactly one credit',async()=>{
    const seed=await pool.connect(), blocker=await pool.connect(), a=await pool.connect(), b=await pool.connect();
    let tasks: Promise<unknown>[]=[];
    try {
      const f=await fixture(seed), code='CI-'+randomUUID();
      // storefront_org_id chooses one open shop. Keep test database unambiguous.
      await seed.query('update public.organizations set storefront_enabled=(id=$1)',[f.org]);
      await seed.query('insert into public.gift_cards(org_id,code,value) values($1,$2,20)',[f.org,code]);
      await blocker.query('begin'); await blocker.query('select id from public.gift_cards where code=$1 for update',[code]);
      await a.query('begin');await b.query('begin');await identity(a,f.customer);await identity(b,f.customer);
      const pids=[await pid(a),await pid(b)];
      const calls=[a,b].map(async client=>{const result=await client.query('select public.redeem_gift_card($1) result',[code]);await client.query('commit');return result.rows[0].result;});
      tasks=calls; const completed=Promise.allSettled(calls);
      await waitForBlocked(pids); await blocker.query('commit');
      const results=await completed;
      expect(results.filter(r=>r.status==='fulfilled' && r.value.ok)).toHaveLength(1);
      const ledger=await seed.query('select count(*)::int n,coalesce(sum(amount),0) amount from public.wallet_ledger where org_id=$1 and ref=$2',[f.org,code]);
      expect(ledger.rows[0].n).toBe(1);expect(Number(ledger.rows[0].amount)).toBe(20);
    } finally { await blocker.query('rollback'); await Promise.allSettled(tasks); await a.query('rollback');await b.query('rollback');[seed,blocker,a,b].forEach(c=>c.release()); }
  });
  it('two checkouts for last unit cannot oversell',async()=>{
    const seed=await pool.connect(), blocker=await pool.connect(), a=await pool.connect(), b=await pool.connect();
    let tasks:Promise<unknown>[]=[];
    try {
      const f=await fixture(seed); await seed.query("insert into public.stock_movements(org_id,location_id,product_id,delta,reason) values($1,$2,$3,-199,'adjustment')",[f.org,f.location,f.product]);
      await blocker.query('begin');await blocker.query('select id from public.stock_movements where location_id=$1 and product_id=$2 for update',[f.location,f.product]);
      await a.query('begin');await b.query('begin'); const pids=[await pid(a),await pid(b)];
      const calls=[a,b].map(async client=>{try {const result=await placeOrder(client,f);await client.query('commit');return result;} catch(error){await client.query('rollback');throw error;}});
      tasks=calls;const completed=Promise.allSettled(calls);
      await waitForBlocked(pids);await blocker.query('commit');const results=await completed;
      expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
      expect(Number((await seed.query('select public.stock_available($1,$2) n',[f.location,f.product])).rows[0].n)).toBe(0);
    } finally {await blocker.query('rollback');await Promise.allSettled(tasks);await a.query('rollback');await b.query('rollback');[seed,blocker,a,b].forEach(c=>c.release());}
  });
  it('last coupon use cannot be claimed by two different checkouts',async()=>{
    const seed=await pool.connect(),blocker=await pool.connect(),a=await pool.connect(),b=await pool.connect();let tasks:Promise<unknown>[]=[];
    try {
      const f=await fixture(seed),code='CI-'+randomUUID();
      await seed.query("insert into public.coupons(org_id,code,kind,value,usage_limit) values($1,$2,'flat',10,1)",[f.org,code]);
      await blocker.query('begin');await blocker.query('select id from public.coupons where code=$1 for update',[code]);
      await a.query('begin');await b.query('begin');const pids=[await pid(a),await pid(b)];
      const calls=[a,b].map(async(client,index)=>{try{const result=await placeOrder(client,f,[1],[index===0?f.product:f.second],'cod',{coupon:code,phone:index===0?'9876543211':'9876543212'});await client.query('commit');return result;}catch(error){await client.query('rollback');throw error;}});
      tasks=calls;const completed=Promise.allSettled(calls);await waitForBlocked(pids);await blocker.query('commit');
      expect((await completed).filter(result=>result.status==='fulfilled')).toHaveLength(1);
      expect((await seed.query('select used_count from public.coupons where code=$1',[code])).rows[0].used_count).toBe(1);
    }finally{await blocker.query('rollback');await Promise.allSettled(tasks);await a.query('rollback');await b.query('rollback');[seed,blocker,a,b].forEach(c=>c.release());}
  });
  it('webhook and stale cancellation leave a consistent order and stock state',async()=>{
    const seed=await pool.connect(),blocker=await pool.connect(),a=await pool.connect(),b=await pool.connect();let tasks:Promise<unknown>[]=[];
    try {
      const f=await fixture(seed),order=(await placeOrder(seed,f,[1],[f.product],'card')).rows[0],id=order.order_id;
      await seed.query("update public.orders set placed_at=now()-interval '31 minutes',razorpay_order_id=$1 where id=$2",['rp-'+id,id]);
      await blocker.query('begin');await blocker.query('select id from public.orders where id=$1 for update',[id]);
      await a.query('begin');await b.query('begin');const pids=[await pid(a),await pid(b)];
      const calls=[(async()=>{const result=await a.query("select public.settle_razorpay_payment($1,$2,$3,'payment.captured','{}')",['pay-'+id,'rp-'+id,Math.round(Number(order.total)*100)]);await a.query('commit');return result;})(),(async()=>{const result=await b.query('select public.cancel_stale_unpaid_orders()');await b.query('commit');return result;})()];
      tasks=calls;const completed=Promise.allSettled(calls);await waitForBlocked(pids);await blocker.query('commit');
      const results=await completed;expect(results.every(result=>result.status==='fulfilled')).toBe(true);
      const state=(await seed.query('select status,is_paid from public.orders where id=$1',[id])).rows[0];
      expect(state.status==='cancelled'&&state.is_paid).toBe(false);
      const reserved=Number((await seed.query('select sum(delta) n from public.stock_movements where ref_id=$1',[id])).rows[0].n);
      if(state.status==='cancelled')expect(reserved).toBe(0);else expect(reserved).toBe(-1);
    }finally{await blocker.query('rollback');await Promise.allSettled(tasks);await a.query('rollback');await b.query('rollback');[seed,blocker,a,b].forEach(c=>c.release());}
  });

});
