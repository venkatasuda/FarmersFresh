import pg from "pg";
const url=new URL(process.env.TEST_DATABASE_URL ?? '');
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Browser seed refuses remote DB');
const pool=new pg.Pool({connectionString:url.toString()});
const org='11111111-1111-4111-8111-111111111111', location='22222222-2222-4222-8222-222222222222', product='33333333-3333-4333-8333-333333333333';
try {
  await pool.query("insert into public.organizations(id,name,slug,storefront_enabled) values($1,'CI Farmers Fresh','ci-store',true)",[org]);
  await pool.query("insert into public.locations(id,org_id,type,name) values($1,$2,'store','CI Store')",[location,org]);
  await pool.query('update public.organizations set storefront_location_id=$1 where id=$2',[location,org]);
  await pool.query("insert into public.products(id,org_id,name,slug,sale_price,is_published,min_order_qty,step_qty) values($1,$2,'CI Fresh Product','ci-fresh-product',100,true,1,1)",[product,org]);
  await pool.query("insert into public.stock_movements(org_id,location_id,product_id,delta,reason) values($1,$2,$3,200,'purchase')",[org,location,product]);
  console.log('Seeded synthetic browser fixture.');
} finally { await pool.end(); }
