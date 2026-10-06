import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { pool, fixture, identity, expectDenied, type Fixture } from "./helpers";

let client: PoolClient, f: Fixture;
beforeEach(async () => { client = await pool.connect(); await client.query("begin"); f = await fixture(client); });
afterEach(async () => { await client.query("rollback"); client.release(); });
afterAll(() => pool.end());

async function createPo(location: string, ordered = false) {
  return (await client.query("select public.create_purchase_order_with_items($1,null,'CI purchase',$2,$3) po",
    [location, JSON.stringify([{ productId: f.product, qty: 2, unitCost: 50 }]), ordered])).rows[0].po;
}

it("binds inventory and every purchase-order operation to the manager's store, including mixed memberships", async () => {
  const secondStore = randomUUID();
  await client.query("insert into public.locations(id,org_id,type,name) values($1,$2,'store','Second store')", [secondStore, f.org]);
  await client.query("update public.memberships set role='manager' where user_id=$1", [f.staff]);
  await client.query("insert into public.memberships(org_id,user_id,location_id,role) values($1,$2,$3,'staff')", [f.org, f.staff, secondStore]);
  await identity(client, f.owner);
  const hidden = await createPo(secondStore), own = await createPo(f.location);
  const hiddenBatch = (await client.query('select public.record_production($1,$2,1) id', [secondStore, f.product])).rows[0].id;
  await identity(client, f.staff);
  expect((await client.query("select * from public.operational_locations('inventory.adjust')")).rows.map(r => r.id)).toEqual([f.location]);
  expect((await client.query("select * from public.operational_locations('procurement.manage')")).rows.map(r => r.id)).toEqual([f.location]);
  expect((await client.query("select public.list_purchase_orders() data")).rows[0].data.map((r: { id: string }) => r.id)).toEqual([own.id]);
  expect((await client.query("select public.get_purchase_order($1) data", [hidden.id])).rows[0].data).toBeNull();
  expect((await client.query("select public.procurement_overview() data")).rows[0].data.open_pos).toBe(1);
  expect((await client.query("select id from public.purchase_orders")).rows.map(r => r.id)).toEqual([own.id]);
  expect((await client.query("select po_id from public.purchase_order_items")).rows.map(r => r.po_id)).toEqual([own.id]);
  await expectDenied(client, () => createPo(secondStore));
  await expectDenied(client, () => createPo(f.otherLocation));
  for (const name of ['cancel_purchase_order','mark_po_ordered'])
    await expectDenied(client, () => client.query(`select public.${name}($1)`, [hidden.id]));
  await expectDenied(client, () => client.query("select public.add_po_item($1,$2,1,50)", [hidden.id, f.product]));
  await client.query('reset role');
  const hiddenItem = (await client.query('select id from public.purchase_order_items where po_id=$1', [hidden.id])).rows[0].id;
  await identity(client, f.staff);
  await expectDenied(client, () => client.query('select public.remove_po_item($1)', [hiddenItem]));
  await expectDenied(client, () => client.query("select public.receive_purchase_order($1,'[]')", [hidden.id]));
  await expectDenied(client, () => client.query("select public.record_stock($1,$2,1,'purchase')", [secondStore, f.product]));
  await expectDenied(client, () => client.query("select public.log_wastage($1,$2,1,'damage')", [secondStore, f.product]));
  await expectDenied(client, () => client.query("select public.record_production($1,$2,1)", [secondStore, f.product]));
  await expectDenied(client, () => client.query("select public.log_temperature($1,'Freezer',0)", [secondStore]));
  await expectDenied(client, () => client.query('select public.write_off_batch($1)', [hiddenBatch]));
  await expectDenied(client, () => client.query("insert into public.stock_movements(org_id,location_id,product_id,delta,reason) values($1,$2,$3,1,'purchase')", [f.org, f.location, f.product]));
  await client.query("select public.record_stock($1,$2,1,'purchase')", [f.location, f.product]);
  await client.query("savepoint stock_input");
  await expect(client.query("select public.record_stock($1,$2,'NaN','purchase')", [f.location, f.product])).rejects.toThrow('Invalid amount');
  await client.query("rollback to savepoint stock_input");
  await client.query("select public.cancel_purchase_order($1)", [own.id]);
  await client.query("reset role");
  expect((await client.query("select count(*)::int n from public.events where entity_id=$1 and event_type='purchase_order.cancelled'", [own.id])).rows[0].n).toBe(1);
  await client.query("delete from public.memberships where user_id=$1 and role='manager'", [f.staff]);
  await identity(client, f.staff);
  expect((await client.query("select * from public.operational_locations('procurement.manage')")).rows).toEqual([]);
  await expectDenied(client, () => createPo(f.location));
});

it("receives an authorized order once and rolls back malformed receipt items", async () => {
  await client.query("update public.memberships set role='manager' where user_id=$1", [f.staff]);
  await identity(client, f.staff);
  const own = await createPo(f.location, true);
  const item = (await client.query("select public.get_purchase_order($1) data", [own.id])).rows[0].data.items[0];
  for (const items of [[], [{ item_id: randomUUID(), qty: 1 }], [{ item_id: item.id, qty: 3 }], [{ item_id: item.id, qty: 1 }, { item_id: item.id, qty: 1 }]]) {
    await client.query("savepoint receipt");
    await expect(client.query("select public.receive_purchase_order($1,$2)", [own.id, JSON.stringify(items)])).rejects.toThrow();
    await client.query("rollback to savepoint receipt");
    expect((await client.query("select public.get_purchase_order($1) data", [own.id])).rows[0].data.status).toBe('ordered');
  }
  await client.query("select public.receive_purchase_order($1,$2)", [own.id, JSON.stringify([{ item_id: item.id, qty: 2 }])]);
  expect(Number((await client.query("select quantity from public.stock_on_hand where location_id=$1 and product_id=$2", [f.location, f.product])).rows[0].quantity)).toBe(202);
  expect((await client.query("select public.get_purchase_order($1) data", [own.id])).rows[0].data.status).toBe('received');
  await client.query("savepoint duplicate_receipt");
  await expect(client.query("select public.receive_purchase_order($1,$2)", [own.id, JSON.stringify([{ item_id: item.id, qty: 2 }])])).rejects.toThrow();
  await client.query("rollback to savepoint duplicate_receipt");
  await client.query("reset role");
  expect((await client.query("select count(*)::int n from public.events where entity_id=$1 and event_type='purchase.received'", [own.id])).rows[0].n).toBe(1);
});

it("denies staff, accountants, customers and anonymous users inventory writes and purchase data", async () => {
  await identity(client, f.owner);
  const own = await createPo(f.location);
  for (const user of [f.staff, f.customer, f.outsider]) {
    await identity(client, user);
    expect((await client.query("select public.get_purchase_order($1) data", [own.id])).rows[0].data).toBeNull();
    expect((await client.query("select public.list_purchase_orders() data")).rows[0].data).toEqual([]);
    await expectDenied(client, () => client.query("select public.record_stock($1,$2,1,'purchase')", [f.location, f.product]));
    await expectDenied(client, () => createPo(f.location));
  }
  await client.query("reset role");
  await client.query("update public.memberships set role='accountant' where user_id=$1", [f.staff]);
  await identity(client, f.staff);
  expect((await client.query("select * from public.operational_locations('inventory.adjust')")).rows).toEqual([]);
  await expectDenied(client, () => createPo(f.location));
  await identity(client, f.customer, 'anon');
  await expectDenied(client, () => client.query("select public.operational_locations('inventory.adjust')"));
  await expectDenied(client, () => createPo(f.location));
});
