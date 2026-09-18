import { test, expect } from "@playwright/test";
import pg from "pg";
test('guest COD checkout ignores tampered display price and reserves inventory',async({page})=>{
  const dbUrl=new URL(process.env.TEST_DATABASE_URL ?? '');
  if(!['localhost','127.0.0.1','[::1]'].includes(dbUrl.hostname))throw new Error('Checkout assertion refuses remote DB');
  const pool=new pg.Pool({connectionString:dbUrl.toString()});
  const phone='9'+String(Math.floor(Math.random()*1_000_000_000)).padStart(9,'0');
  try {
    await page.addInitScript(()=>localStorage.setItem('ff.cart.v1',JSON.stringify([{productId:'33333333-3333-4333-8333-333333333333',slug:'ci-fresh-product',name:'CI Fresh Product',unit:'kg',price:1,imagePath:null,quantity:1,packLabel:null,step:1}])));
    await page.goto('/checkout');
    await page.locator('[name="name"]').fill('CI Guest');await page.locator('[name="phone"]').fill(phone);
    await page.locator('[name="address"]').fill('Synthetic CI Address');await page.locator('[name="city"]').fill('CI City');await page.locator('[name="pincode"]').fill('500001');
    await page.getByRole('button',{name:'Place order',exact:true}).click();
    await expect(page).toHaveURL(/\/order-placed/, {timeout:15000});
    const order=(await pool.query('select id,total,is_paid,status from public.orders where contact_phone=$1',[phone])).rows;
    expect(order).toHaveLength(1);expect(Number(order[0].total)).toBe(140);expect(order[0].is_paid).toBe(false);expect(order[0].status).toBe('placed');
    const items=(await pool.query('select quantity,unit_price from public.order_items where order_id=$1',[order[0].id])).rows;
    expect(items).toEqual([{quantity:'1.000',unit_price:'100.00'}]);
    const reserve=(await pool.query("select sum(delta) n from public.stock_movements where ref_id=$1 and reason='order_reserved'",[order[0].id])).rows[0];
    expect(Number(reserve.n)).toBe(-1);
  } finally {await pool.end();}
});
