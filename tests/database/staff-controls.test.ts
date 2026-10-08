import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { pool, fixture, identity, placeOrder, expectDenied, type Fixture } from "./helpers";
let db: PoolClient, f: Fixture;
beforeEach(async () => { db=await pool.connect(); await db.query("begin"); f=await fixture(db); });
afterEach(async () => {await db.query("rollback"); db.release();});
afterAll(() => pool.end());
async function rejects(sql:string,args:unknown[],pattern:RegExp) {await db.query("savepoint staff_bad"); await expect(db.query(sql,args)).rejects.toThrow(pattern); await db.query("rollback to savepoint staff_bad");}
const assign = (role:string|null)=>db.query("select public.set_staff_access($1,$2,$3,'Staff role review')",[f.staff,f.location,role]);
it("lets only owners grant, change and revoke location roles, with one audit event per effective change",async()=>{
  await identity(db,f.owner); await assign("manager"); await assign("manager");
  await identity(db,f.staff); expect((await db.query("select public.has_location_permission($1,'inventory.adjust') allowed",[f.location])).rows[0].allowed).toBe(true);
  await expectDenied(db,()=>assign("accountant"));
  await identity(db,f.owner); await assign("accountant"); await assign(null); await assign(null);
  await identity(db,f.staff); expect((await db.query("select public.has_permission('orders.manage') allowed")).rows[0].allowed).toBe(false);
  await expectDenied(db,()=>db.query("select public.manager_dashboard()"));
  await identity(db,f.owner);
  const overview=(await db.query("select public.staff_access_overview() data")).rows[0].data;
  expect(overview.memberships).toEqual([]); expect(overview.audit).toHaveLength(3);
  expect(overview.audit.every((a:{actor_id:string;payload:{reason:string}})=>a.actor_id===f.owner && a.payload.reason==="Staff role review")).toBe(true);
});
it("denies self changes, owner targets, cross-organization accounts/stores and direct client edits",async()=>{
  await identity(db,f.owner);
  await rejects("select public.set_staff_access($1,$2,'manager','Reason')",[f.owner,f.location],/own access/);
  await expectDenied(db,()=>db.query("select public.set_staff_access($1,$2,'manager','Reason')",[f.outsider,f.location]));
  await expectDenied(db,()=>db.query("select public.set_staff_access($1,$2,'manager','Reason')",[f.staff,f.otherLocation]));
  await rejects("select public.set_staff_access($1,$2,'owner','Reason')",[f.staff,f.location],/supported staff role/);
  await rejects("select public.set_staff_access($1,$2,'staff','')",[f.staff,f.location],/access reason/);
  await rejects("update public.memberships set role='manager' where user_id=$1",[f.staff],/permission denied/);
  for(const user of [f.staff,f.customer,f.outsider]) {await identity(db,user); await expectDenied(db,()=>db.query("select public.staff_access_overview()")); await expectDenied(db,()=>assign("manager"));}
  await identity(db,f.owner,"anon"); await expectDenied(db,()=>assign("staff"));
});
it("requires reassignment before revoking a rider's active work, and audits owner changes",async()=>{
  const order=(await placeOrder(db,f)).rows[0];
  await db.query("update public.orders set assigned_to=$2,status='out_for_delivery' where id=$1",[order.order_id,f.staff]);
  await identity(db,f.owner); await rejects("select public.set_staff_access($1,$2,null,'Leave')",[f.staff,f.location],/Reassign/);
  await db.query("select public.set_member_owner($1,true)",[f.staff]); await db.query("select public.set_member_owner($1,true)",[f.staff]);
  await expectDenied(db,()=>assign(null));
  const data=(await db.query("select public.staff_access_overview() data")).rows[0].data;
  expect(data.audit.filter((a:{event_type:string})=>a.event_type==='staff.owner_changed')).toHaveLength(1);
  await rejects("select public.set_member_owner($1,false)",[f.owner],/own owner/);
});
it("keeps manager counts and activity inside exact store assignments, including mixed roles",async()=>{
  const other=randomUUID();
  await db.query("insert into public.locations(id,org_id,type,name) values($1,$2,'store','Hidden store')",[other,f.org]);
  await db.query("update public.memberships set role='manager' where user_id=$1",[f.staff]);
  await db.query("insert into public.memberships(org_id,user_id,location_id,role) values($1,$2,$3,'accountant')",[f.org,f.staff,other]);
  const a=(await placeOrder(db,f)).rows[0], b=(await placeOrder(db,f)).rows[0];
  await db.query("update public.orders set placed_at=now()-interval '1 hour' where id=$1",[a.order_id]);
  await db.query("update public.orders set location_id=$2,placed_at=now()-interval '1 hour' where id=$1",[b.order_id,other]);
  await db.query("insert into public.events(org_id,location_id,event_type) values($1,$2,'visible.drill'),($1,$3,'hidden.drill')",[f.org,f.location,other]);
  await identity(db,f.staff);
  const data=(await db.query("select public.manager_dashboard() data")).rows[0].data;
  expect(data.locations.map((l:{id:string})=>l.id)).toEqual([f.location]);
  expect(data.stores).toEqual([expect.objectContaining({id:f.location,open_orders:1,overdue:1})]);
  expect(data.audit.map((e:{event_type:string})=>e.event_type)).toContain('visible.drill');
  expect(data.audit.map((e:{event_type:string})=>e.event_type)).not.toContain('hidden.drill');
  expect((await db.query("select id from public.orders")).rows.map(r=>r.id)).toEqual([a.order_id]);
  expect((await db.query("select distinct order_id from public.order_items")).rows.map(r=>r.order_id)).toEqual([a.order_id]);
  await expectDenied(db,()=>db.query("select public.manager_dashboard($1)",[other]));
  await expectDenied(db,()=>db.query("select * from public.record_sale($1,null,array[row($2,1,100)::public.sale_line],'cash',100)",[other,f.product]));
  await expectDenied(db,()=>db.query("select public.instant_refund($1,5,'Wrong store')",[b.order_id]));
  await identity(db,f.owner); await assign(null);
  await identity(db,f.staff); await expectDenied(db,()=>db.query("select public.manager_dashboard()"));
});
it("refuses unpaid, excessive, fractional and staff wallet compensation",async()=>{
  const placed=(await placeOrder(db,f)).rows[0];
  await db.query("update public.orders set user_id=$2,status='delivered' where id=$1",[placed.order_id,f.customer]);
  await identity(db,f.owner);
  await rejects("select public.instant_refund($1,10,'Damage')",[placed.order_id],/paid delivered/);
  await db.query("reset role"); await db.query("update public.orders set is_paid=true where id=$1",[placed.order_id]);
  await identity(db,f.staff); await expectDenied(db,()=>db.query("select public.instant_refund($1,5,'Damage')",[placed.order_id]));
  await identity(db,f.owner);
  for(const amount of [NaN,Infinity,1.001,Number(placed.total)+1]) await rejects("select public.instant_refund($1,$2,'Damage')",[placed.order_id,amount],/exceeds collected/);
  await db.query("select public.instant_refund($1,$2,'Damage')",[placed.order_id,placed.total]);
  await rejects("select public.instant_refund($1,1,'Repeated')",[placed.order_id],/exceeds collected/);
});
it("reports operational exceptions from actual orders, stock, expiry and till ledgers",async()=>{
  const a=(await placeOrder(db,f)).rows[0], b=(await placeOrder(db,f)).rows[0];
  await db.query("update public.orders set status='out_for_delivery',delivery_failure_note='Customer unavailable',placed_at=now()-interval '1 hour' where id=$1",[a.order_id]);
  await db.query("update public.orders set status='delivered' where id=$1",[b.order_id]);
  await db.query("insert into public.stock_movements(org_id,location_id,product_id,delta,reason) values($1,$2,$3,-196,'waste')",[f.org,f.location,f.product]);
  await db.query("insert into public.product_batches(org_id,location_id,product_id,batch_code,remaining_qty,expiry_date) values($1,$2,$3,'CI expiry',1,(clock_timestamp() at time zone 'Asia/Kolkata')::date+1)",[f.org,f.location,f.product]);
  await identity(db,f.owner);
  const shift=randomUUID(); await db.query("select public.open_cash_shift($1,$2,20)",[shift,f.location]);
  await db.query("select public.close_cash_shift($1,20,19,'Shortage reviewed')",[shift]);
  const data=(await db.query("select public.manager_dashboard($1) data",[f.location])).rows[0].data;
  expect(data.stores[0]).toMatchObject({open_orders:1,overdue:1,failed_deliveries:1,uncollected_cod:1,low_stock:1,expiring_batches:1,cash_variances:1});
});
it("returns an empty owner dashboard before the first store is created",async()=>{
  const empty=randomUUID();
  await db.query("insert into public.organizations(id,name,slug) values($1,'Empty organization',$2)",[empty,`empty-${empty}`]);
  await db.query("update public.profiles set org_id=$2 where id=$1",[f.owner,empty]);
  await identity(db,f.owner);
  expect((await db.query("select public.manager_dashboard() data")).rows[0].data).toEqual({locations:[],stores:[],audit:[]});
});
