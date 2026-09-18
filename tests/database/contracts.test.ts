import { afterAll, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from './helpers';
afterAll(()=>pool.end());
function files(directory:string):string[] {return readdirSync(directory,{withFileTypes:true}).flatMap(item=>item.isDirectory()?files(join(directory,item.name)):/\.tsx?$/.test(item.name)?[join(directory,item.name)]:[]);}
describe('application/database deployment contract',()=>{
  it('every statically named application RPC exists in the deployed test schema',async()=>{
    const names=new Set<string>();
    for(const file of [...files('app'),...files('lib')])for(const match of readFileSync(file,'utf8').matchAll(/\.rpc\(\s*["']([^"']+)["']/g))names.add(match[1]);
    expect(names.size).toBeGreaterThan(20);
    const functions=await pool.query("select distinct proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'");
    const available=new Set(functions.rows.map(row=>row.proname));expect([...names].filter(name=>!available.has(name))).toEqual([]);
  });
  it.each(['anon','authenticated'])('%s has no execute privilege on service-only money functions',async role=>{
    const result=await pool.query(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=any($1::text[]) and has_function_privilege($2,p.oid,'EXECUTE')`,[['mark_order_paid','activate_membership','settle_razorpay_payment','cancel_stale_unpaid_orders'],role]);
    expect(result.rows).toEqual([]);
  });
  it('financial and identity tables have RLS enabled',async()=>{
    const tables=['profiles','memberships','orders','order_items','wallet_ledger','gift_cards','payment_events'];
    const result=await pool.query("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any($1)",[tables]);
    expect(result.rows).toHaveLength(tables.length);expect(result.rows.filter(row=>!row.relrowsecurity)).toEqual([]);
  });
});
