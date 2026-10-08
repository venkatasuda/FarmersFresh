import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { pool, fixture, identity, placeOrder, expectDenied, type Fixture } from "./helpers";

let client:PoolClient, f:Fixture, order:string, rider:string, otherStore:string;
beforeEach(async()=>{
  client=await pool.connect(); await client.query("begin"); f=await fixture(client);
  rider=randomUUID(); otherStore=randomUUID();
  await client.query("insert into auth.users(id,email) values($1,$2)",[rider,rider+"@ci.invalid"]);
  await client.query("insert into public.profiles(id,org_id) values($1,$2)",[rider,f.org]);
  await client.query("insert into public.memberships(org_id,user_id,location_id,role) values($1,$2,$3,'staff')",[f.org,rider,f.location]);
  await client.query("insert into public.locations(id,org_id,type,name) values($1,$2,'store','Other same-org store')",[otherStore,f.org]);
  order=(await placeOrder(client,f)).rows[0].order_id;
  await identity(client,f.owner);
  await client.query("select public.set_order_status($1,'confirmed')",[order]);
});
afterEach(async()=>{await client.query("rollback"); client.release();});
afterAll(()=>pool.end());
async function rejects(fn:()=>Promise<unknown>,message:RegExp) {
  await client.query("savepoint bad_delivery"); await expect(fn()).rejects.toThrow(message);
  await client.query("rollback to savepoint bad_delivery");
}
const claim=(take=true)=>client.query("select public.claim_delivery($1,$2)",[order,take]);
async function dispatch() {
  await identity(client,rider); await claim();
  await client.query("select public.set_order_status($1,'packed')",[order]);
  await client.query("select public.set_order_status($1,'out_for_delivery')",[order]);
}

it("claims and releases exactly once and never takes another rider's order",async()=>{
  await identity(client,f.staff); await claim(); await claim();
  await identity(client,rider); await rejects(()=>claim(),/another rider/); await rejects(()=>claim(false),/another rider/);
  await identity(client,f.staff); await claim(false); await claim(false);
  await client.query("reset role");
  expect((await client.query("select event_type from public.events where entity_id=$1 and event_type like 'delivery.%' order by event_type",[order])).rows.map(r=>r.event_type)).toEqual(['delivery.claimed','delivery.released']);
});

it("rejects customer, accountant, foreign-store and anonymous delivery mutations",async()=>{
  await client.query("reset role");
  await client.query("update public.memberships set role='accountant' where user_id=$1",[f.staff]);
  for(const user of [f.staff,f.customer,f.outsider]) {
    await identity(client,user); await expectDenied(client,()=>claim());
    await expectDenied(client,()=>client.query("select public.auto_assign_deliveries()"));
    await expectDenied(client,()=>client.query("select public.set_my_shift(true)"));
  }
  await client.query("reset role"); await client.query("update public.orders set location_id=$1 where id=$2",[otherStore,order]);
  await identity(client,rider); await expectDenied(client,()=>claim());
  await identity(client,f.customer,'anon'); await expectDenied(client,()=>claim());
  await client.query("select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{\"role\":\"authenticated\"}',true)");
  await expectDenied(client,()=>client.query("select public.auto_assign_deliveries()"));
});

it("shares GPS only for the assigned active rider and validates finite coordinates",async()=>{
  await dispatch();
  await identity(client,f.staff);
  await expectDenied(client,()=>client.query("select public.update_rider_location($1,17,78,10)",[order]));
  await identity(client,rider);
  for(const [lat,lng,eta] of [[NaN,78,10],[Infinity,78,10],[17,NaN,10],[91,78,10],[17,181,10],[17,78,-1],[17,78,1441]])
    await rejects(()=>client.query("select public.update_rider_location($1,$2,$3,$4)",[order,lat,lng,eta]),/Invalid location/);
  await client.query("select public.update_rider_location($1,17,78,10)",[order]);
  await rejects(()=>claim(false),/Only confirmed or packed/);
  await client.query("select public.set_order_status($1,'delivered')",[order]);
  await rejects(()=>client.query("select public.update_rider_location($1,17,78,10)",[order]),/not currently/);
});

it("records failure and physical return without changing money or reserved stock",async()=>{
  await dispatch();
  const before=(await client.query("select total,paid_at,public.stock_available(location_id,$2) stock from public.orders where id=$1",[order,f.product])).rows[0];
  await rejects(()=>client.query("select public.report_delivery_failure($1,'  ')",[order]),/reason/);
  await client.query("select public.report_delivery_failure($1,'Customer unavailable')",[order]);
  await client.query("select public.report_delivery_failure($1,'Customer unavailable')",[order]);
  const number=(await client.query("select order_number from public.orders where id=$1",[order])).rows[0].order_number;
  const tracked=(await client.query("select public.track_order($1,'9876543210') data",[number])).rows[0].data;
  expect(tracked.delivery_failed).toBe(true);
  expect(tracked.tracking).toBeNull();
  expect(tracked.delivery_failure_note).toBeUndefined();
  await rejects(()=>client.query("select public.set_order_status($1,'delivered')",[order]),/Return the failed/);
  await rejects(()=>client.query("select public.update_rider_location($1,17,78,10)",[order]),/not currently/);
  await identity(client,f.staff); await client.query("select public.receive_failed_delivery($1)",[order]);
  await client.query("select public.receive_failed_delivery($1)",[order]);
  const after=(await client.query("select total,paid_at,public.stock_available(location_id,$2) stock,status,assigned_to,delivery_failed_at from public.orders where id=$1",[order,f.product])).rows[0];
  expect(after).toMatchObject({...before,status:'packed',assigned_to:null,delivery_failed_at:null});
  await claim(); await client.query("select public.set_order_status($1,'out_for_delivery')",[order]);
  await client.query("select public.set_order_status($1,'delivered')",[order]);
  await client.query("reset role");
  const events=(await client.query("select event_type,count(*)::int n from public.events where entity_id=$1 and event_type in ('delivery.failed','delivery.returned') group by event_type order by event_type",[order])).rows;
  expect(events).toEqual([{event_type:'delivery.failed',n:1},{event_type:'delivery.returned',n:1}]);
});

it("only the assigned rider reports failure and only authorized store staff receive it",async()=>{
  await dispatch(); await identity(client,f.staff);
  await expectDenied(client,()=>client.query("select public.report_delivery_failure($1,'Unavailable')",[order]));
  await identity(client,rider); await client.query("select public.report_delivery_failure($1,'Unavailable')",[order]);
  await client.query("reset role"); await client.query("update public.memberships set location_id=$1 where user_id=$2",[otherStore,f.staff]);
  await identity(client,f.staff); await expectDenied(client,()=>client.query("select public.receive_failed_delivery($1)",[order]));
});

it("auto-assignment uses on-shift delivery roles at the same store and retries do nothing",async()=>{
  await client.query("reset role");
  await client.query("update public.memberships set role='accountant',on_shift=true where user_id=$1",[f.staff]);
  await client.query("update public.memberships set location_id=$1,on_shift=true where user_id=$2",[otherStore,rider]);
  await identity(client,f.owner);
  expect((await client.query("select public.auto_assign_deliveries() n")).rows[0].n).toBe(0);
  await client.query("reset role"); await client.query("update public.memberships set location_id=$1 where user_id=$2",[f.location,rider]);
  await identity(client,f.owner);
  expect((await client.query("select public.auto_assign_deliveries() n")).rows[0].n).toBe(1);
  expect((await client.query("select public.auto_assign_deliveries() n")).rows[0].n).toBe(0);
  expect((await client.query("select assigned_to from public.orders where id=$1",[order])).rows[0].assigned_to).toBe(rider);
});

it("shift changes affect only delivery memberships and produce one event per change",async()=>{
  await client.query("reset role");
  await client.query("insert into public.memberships(org_id,user_id,location_id,role) values($1,$2,$3,'accountant')",[f.org,rider,otherStore]);
  await identity(client,rider); await client.query("select public.set_my_shift(true)"); await client.query("select public.set_my_shift(true)");
  await client.query("reset role");
  const memberships=(await client.query("select role,on_shift from public.memberships where user_id=$1 order by role",[rider])).rows;
  expect(memberships).toEqual([{role:'accountant',on_shift:false},{role:'staff',on_shift:true}]);
  expect((await client.query("select count(*)::int n from public.events where entity_id=$1 and event_type='delivery.shift_changed'",[rider])).rows[0].n).toBe(1);
});
