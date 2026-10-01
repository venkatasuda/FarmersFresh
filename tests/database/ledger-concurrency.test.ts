import { afterAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool, fixture, identity, placeOrder } from "./helpers";

afterAll(() => pool.end());

// Hold the shared ledger lock until both real sessions are waiting on it.
async function race<T>(key: string, calls: ((client: PoolClient) => Promise<T>)[]) {
  const blocker = await pool.connect();
  const clients = await Promise.all(calls.map(() => pool.connect()));
  let tasks: Promise<T>[] = [];
  try {
    await blocker.query("begin");
    await blocker.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [key]);
    const pids = await Promise.all(clients.map(async client => {
      await client.query("begin");
      return (await client.query("select pg_backend_pid() id")).rows[0].id;
    }));
    tasks = clients.map(async (client, index) => {
      try {
        const result = await calls[index](client);
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    });
    const completed = Promise.allSettled(tasks);
    const deadline = Date.now() + 8000;
    let blocked = false;
    while (Date.now() < deadline) {
      const result = await pool.query("select count(*)::int n from pg_stat_activity where pid=any($1::int[]) and wait_event_type='Lock'", [pids]);
      if (result.rows[0].n === clients.length) { blocked = true; break; }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    expect(blocked).toBe(true);
    await blocker.query("commit");
    return await completed;
  } finally {
    await blocker.query("rollback");
    await Promise.allSettled(tasks);
    for (const client of clients) { await client.query("rollback"); client.release(); }
    blocker.release();
  }
}

it("checkout, POS and subscription competing for the last unit cannot oversell", async () => {
  const seed = await pool.connect();
  try {
    const f = await fixture(seed), subscription = randomUUID();
    await seed.query("insert into public.stock_movements(org_id,location_id,product_id,delta,reason) values($1,$2,$3,-199,'adjustment')", [f.org, f.location, f.product]);
    await seed.query("insert into public.subscriptions(id,org_id,user_id,product_id,quantity,frequency,next_run,contact_name,contact_phone,address_line,pincode) values($1,$2,$3,$4,1,'weekly',current_date,'CI','9876543210','CI Address','500001')", [subscription, f.org, f.customer, f.product]);
    await race(`stock:${f.location}:${f.product}`, [
      client => placeOrder(client, f),
      client => client.query("select public.run_one_subscription($1)", [subscription]),
      async client => {
        await identity(client, f.owner);
        return client.query("select * from public.record_sale($1,null,array[row($2::uuid,1,100)::public.sale_line],'cash',100)", [f.location, f.product]);
      },
    ]);
    expect(Number((await seed.query("select public.stock_available($1,$2) n", [f.location, f.product])).rows[0].n)).toBe(0);
    expect((await seed.query("select ((select count(*) from public.orders where org_id=$1)+(select count(*) from public.sales where org_id=$1))::int n", [f.org])).rows[0].n).toBe(1);
  } finally { seed.release(); }
});

it("different checkout products cannot spend the same wallet credit twice", async () => {
  const seed = await pool.connect();
  try {
    const f = await fixture(seed);
    await seed.query("update public.organizations set storefront_enabled=(id=$1)", [f.org]);
    await seed.query("insert into public.wallet_ledger(org_id,user_id,amount,reason) values($1,$2,100,'earned')", [f.org, f.customer]);
    const results = await race(`wallet:${f.org}:${f.customer}`, [f.product, f.second].map(product => async client => {
      await identity(client, f.customer);
      return placeOrder(client, f, [1], [product], "cod", { useCredit: true });
    }));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const balance = await seed.query("select sum(amount) balance from public.wallet_ledger where org_id=$1 and user_id=$2", [f.org, f.customer]);
    expect(Number(balance.rows[0].balance)).toBe(0);
    expect((await seed.query("select count(*)::int n from public.orders where org_id=$1", [f.org])).rows[0].n).toBe(1);
  } finally { seed.release(); }
});

it("competing return approvals award a refund credit once", async () => {
  const seed = await pool.connect();
  try {
    const f = await fixture(seed), id = randomUUID();
    const order = (await placeOrder(seed, f)).rows[0];
    await seed.query("insert into public.returns(id,org_id,user_id,order_id,order_number,reason) values($1,$2,$3,$4,$5,'CI return')", [id, f.org, f.customer, order.order_id, order.order_number]);
    const results = await race(`wallet:${f.org}:${f.customer}`, [0, 1].map(() => async client => {
      await identity(client, f.owner);
      return client.query("select public.approve_return($1,20)", [id]);
    }));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const ledger = await seed.query("select count(*)::int n,sum(amount) amount from public.wallet_ledger where org_id=$1 and user_id=$2 and reason='refund'", [f.org, f.customer]);
    expect(ledger.rows[0].n).toBe(1);
    expect(Number(ledger.rows[0].amount)).toBe(20);
  } finally { seed.release(); }
});

it("an empty wallet cannot be debited and a stock movement cannot cross organizations", async () => {
  const seed = await pool.connect();
  try {
    const f = await fixture(seed);
    await expect(seed.query("insert into public.wallet_ledger(org_id,user_id,amount,reason) values($1,$2,-1,'redeemed')", [f.org, f.customer])).rejects.toMatchObject({ code: "23514" });
    await expect(seed.query("insert into public.stock_movements(org_id,location_id,product_id,delta,reason) values($1,$2,$3,1,'purchase')", [f.org, f.otherLocation, f.product])).rejects.toMatchObject({ code: "23514" });
  } finally { seed.release(); }
});

it("a subscription can produce only one order for its due cycle", async () => {
  const seed = await pool.connect();
  try {
    const f = await fixture(seed), subscription = randomUUID();
    await seed.query("update public.organizations set delivery_fee=17,free_delivery_threshold=1000 where id=$1", [f.org]);
    await seed.query("insert into public.subscriptions(id,org_id,user_id,product_id,quantity,frequency,next_run,contact_name,contact_phone,address_line) values($1,$2,$3,$4,1,'weekly',current_date,'CI','9876543210','CI Address')", [subscription, f.org, f.customer, f.product]);
    const results = await race(`stock:${f.location}:${f.product}`, [
      client => client.query("select public.run_one_subscription($1) ok", [subscription]),
      client => client.query("select public.run_one_subscription($1) ok", [subscription]),
    ]);
    expect(results.filter(result => result.status === "fulfilled" && result.value.rows[0].ok)).toHaveLength(1);
    const orders = await seed.query("select delivery_fee from public.orders where org_id=$1", [f.org]);
    expect(orders.rows).toHaveLength(1);
    expect(Number(orders.rows[0].delivery_fee)).toBe(17);
  } finally { seed.release(); }
});
