import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { pool, fixture, identity, expectDenied, type Fixture } from "./helpers";

let client:PoolClient, f:Fixture, destination:string, receiver:string;
beforeEach(async()=>{
  client=await pool.connect(); await client.query("begin"); f=await fixture(client);
  destination=randomUUID(); receiver=randomUUID();
  await client.query("insert into public.locations(id,org_id,type,name) values($1,$2,'store','Receiving store')",[destination,f.org]);
  await client.query("insert into auth.users(id,email) values($1,$2)",[receiver,receiver+"@ci.invalid"]);
  await client.query("insert into public.profiles(id,org_id) values($1,$2)",[receiver,f.org]);
  await client.query("update public.memberships set role='manager' where user_id=$1",[f.staff]);
  await client.query("insert into public.memberships(org_id,user_id,location_id,role) values($1,$2,$3,'manager'),($1,$4,$3,'staff')",[f.org,receiver,destination,f.staff]);
});
afterEach(async()=>{await client.query("rollback");client.release();});
afterAll(()=>pool.end());
const transfer=(id=randomUUID(),qty=5,to=destination)=>client.query("select public.dispatch_stock_transfer($1,$2,$3,$4,$5,'Inventory test') id",[id,f.location,to,f.product,qty]);
const count=(id:string,qty:number,expected:number)=>client.query("select public.count_stock($1,$2,$3,$4,$5,'Shelf count')",[id,f.location,f.product,qty,expected]);
async function rejects(operation:()=>Promise<unknown>,message:RegExp) {
  await client.query("savepoint invalid_input"); await expect(operation()).rejects.toThrow(message); await client.query("rollback to savepoint invalid_input");
}
async function balance(location:string=f.location) {
  return Number((await client.query("select public.stock_available($1,$2) n",[location,f.product])).rows[0].n);
}

it("counts up, down and zero once, rejects stale counts and reused request IDs",async()=>{
  await identity(client,f.staff);
  const id=randomUUID(); await count(id,198,200); await count(id,198,200);
  expect(await balance()).toBe(198);
  await rejects(()=>count(id,199,200),/already used/);
  await rejects(()=>count(randomUUID(),197,200),/Stock changed/);
  await count(randomUUID(),202,198); await count(randomUUID(),0,202);
  expect(await balance()).toBe(0);
  await client.query("reset role");
  expect((await client.query("select count(*)::int n from public.events where entity_id=$1 and event_type='stock.counted'",[id])).rows[0].n).toBe(1);
});

it("moves batches at dispatch and receipt exactly once, with expiry and origin intact",async()=>{
  await client.query("update public.product_batches set expiry_date=current_date+5,unit_cost=25 where location_id=$1 and product_id=$2",[f.location,f.product]);
  const original=(await client.query("select id from public.product_batches where location_id=$1 and product_id=$2",[f.location,f.product])).rows[0].id;
  await identity(client,f.staff);
  const id=randomUUID(); await transfer(id); await transfer(id);
  expect(await balance()).toBe(195); expect(await balance(destination)).toBe(0);
  await expectDenied(client,()=>client.query("select public.receive_stock_transfer($1)",[id]));
  await identity(client,receiver);
  expect((await client.query("select id from public.stock_transfers")).rows).toEqual([{id}]);
  await expectDenied(client,()=>transfer());
  await client.query("select public.receive_stock_transfer($1)",[id]);
  await client.query("select public.receive_stock_transfer($1)",[id]);
  expect(await balance(destination)).toBe(5);
  const b=(await client.query("select origin_batch_id,remaining_qty,unit_cost,expiry_date=current_date+5 expiry from public.product_batches where location_id=$1 and product_id=$2",[destination,f.product])).rows[0];
  expect(b).toMatchObject({origin_batch_id:original,remaining_qty:"5.000",unit_cost:"25.00",expiry:true});
  await client.query("reset role");
  expect((await client.query("select event_type from public.events where entity_id=$1 order by event_type",[id])).rows.map(r=>r.event_type)).toEqual(["stock.transfer_dispatched","stock.transfer_received"]);
});

it("rejects insufficient, expired and cross-organization transfers without partial ledger changes",async()=>{
  await identity(client,f.staff);
  await rejects(()=>transfer(randomUUID(),201),/Insufficient stock/);
  await rejects(()=>transfer(randomUUID(),1,f.otherLocation),/another store/);
  await client.query("reset role");
  await client.query("update public.product_batches set expiry_date=current_date-1 where location_id=$1 and product_id=$2",[f.location,f.product]);
  await identity(client,f.staff);
  await rejects(()=>transfer(),/unexpired/);
  expect(await balance()).toBe(200);
  expect((await client.query("select id from public.stock_transfers")).rows).toEqual([]);
});

it("writes off goods that expired in transit instead of adding sellable stock",async()=>{
  await identity(client,f.staff); const id=randomUUID(); await transfer(id);
  await client.query("reset role");
  // Simulate elapsed transit time without changing the server clock.
  await client.query("update public.stock_transfers set batches=jsonb_set(batches,'{0,expiry_date}',to_jsonb((current_date-1)::text)) where id=$1",[id]);
  await identity(client,receiver); await client.query("select public.receive_stock_transfer($1)",[id]);
  expect(await balance(destination)).toBe(0);
  expect((await client.query("select public.wastage_summary(30,$1) data",[destination])).rows[0].data.total_events).toBe(1);
});

it("scopes expiry, wastage and batch reads to managed stores and writes off a batch once",async()=>{
  await identity(client,f.owner);
  const own=(await client.query("select public.record_production($1,$2,2,current_date+1) id",[f.location,f.product])).rows[0].id;
  await client.query("select public.record_production($1,$2,3,current_date+1)",[destination,f.product]);
  await client.query("select public.log_wastage($1,$2,1,'damage')",[destination,f.product]);
  await identity(client,f.staff);
  expect((await client.query("select public.expiring_batches(7) data")).rows[0].data.map((b:{id:string})=>b.id)).toEqual([own]);
  expect((await client.query("select public.expiring_batches(7,$1) data",[destination])).rows[0].data).toEqual([]);
  expect((await client.query("select public.list_wastage() data")).rows[0].data).toEqual([]);
  expect((await client.query("select count(*)::int n from public.product_batches where location_id=$1",[destination])).rows[0].n).toBe(0);
  await client.query("select public.write_off_batch($1)",[own]); await client.query("select public.write_off_batch($1)",[own]);
  expect((await client.query("select public.wastage_summary() data")).rows[0].data.total_events).toBe(1);
  await client.query("select public.record_stock($1,$2,-1,'waste','Damaged packaging')",[f.location,f.product]);
  expect((await client.query("select public.wastage_summary() data")).rows[0].data.total_events).toBe(2);
});

it("denies unauthorized writes, direct table writes and the legacy one-sided paths",async()=>{
  await identity(client,f.staff);
  for (const reason of ['transfer_in','transfer_out','stock_count'])
    await rejects(()=>client.query("select public.record_stock($1,$2,1,$3)",[f.location,f.product,reason]),/workflow/);
  await expectDenied(client,()=>client.query("select public.record_stock_adjustment($1,$2,1,'transfer_in')",[f.location,f.product]));
  await expectDenied(client,()=>client.query("delete from public.stock_transfers"));
  await client.query("reset role"); await client.query("update public.memberships set role='accountant' where user_id=$1",[f.staff]);
  for (const user of [f.staff,f.customer,f.outsider]) {
    await identity(client,user); await expectDenied(client,()=>transfer()); await expectDenied(client,()=>count(randomUUID(),1,200));
    expect((await client.query("select public.expiring_batches() data")).rows[0].data).toEqual([]);
  }
  await identity(client,f.customer,'anon'); await expectDenied(client,()=>transfer());
});

it("rejects malformed quantities at the database boundary",async()=>{
  await identity(client,f.staff);
  for (const qty of [0,-1,NaN,Infinity,100001,0.0001]) await rejects(()=>transfer(randomUUID(),qty),/valid stock quantity/);
  for (const qty of [-1,NaN,Infinity,100001,0.0001]) await rejects(()=>count(randomUUID(),qty,200),/valid stock quantity/);
  await client.query("reset role"); await client.query("update public.products set unit='piece' where id=$1",[f.product]);
  await identity(client,f.staff); await rejects(()=>transfer(randomUUID(),1.5),/whole number/);
});
