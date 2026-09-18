import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
function worker() {
  const listeners: Record<string, (event: unknown) => void> = {};
  const stored:string[]=[];
  const response={ok:true,status:200,redirected:false,clone:()=>response};
  const context={self:{location:{origin:'https://ci.invalid'},addEventListener:(type:string,fn:(event:unknown)=>void)=>listeners[type]=fn},
    URL,fetch:async()=>response,caches:{open:async()=>({put:async(request:{url:string})=>stored.push(request.url)}),match:async()=>response}};
  vm.runInNewContext(readFileSync('public/sw.js','utf8'),context);
  return {listeners,stored};
}
describe('PWA privacy',()=>{
  it.each(['/dashboard','/account','/checkout','/api/razorpay/order','/track/x'])('does not intercept private navigation %s',path=>{
    const w=worker();let intercepted=false;
    w.listeners.fetch({request:{method:'GET',mode:'navigate',url:'https://ci.invalid'+path},respondWith:()=>intercepted=true});
    expect(intercepted).toBe(false);
  });
  it('never stores personalised homepage HTML',async()=>{
    const w=worker();let pending:Promise<unknown>|undefined;
    w.listeners.fetch({request:{method:'GET',mode:'navigate',url:'https://ci.invalid/'},respondWith:(promise:Promise<unknown>)=>pending=promise});
    await pending;await Promise.resolve();expect(w.stored).toEqual([]);
  });
});
