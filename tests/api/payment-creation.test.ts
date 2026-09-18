import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const db=vi.hoisted(()=>({read:vi.fn(),save:vi.fn(),update:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({from:()=>({
  select:()=>({eq:()=>({maybeSingle:db.read})}),
  update:db.update,
})})}));
import { POST as order } from '../../app/api/razorpay/order/route';
import { POST as membership } from '../../app/api/razorpay/membership/route';
const network=vi.fn();
beforeEach(()=>{
  vi.stubEnv('RAZORPAY_KEY_ID','rzp_test_ci');vi.stubEnv('RAZORPAY_KEY_SECRET','ci-secret');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','ci-only');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','http://127.0.0.1:54321');
  vi.stubGlobal('fetch',network);
  network.mockResolvedValue(new Response(JSON.stringify({id:'rp-created',amount:12345}),{status:200}));
  db.read.mockResolvedValue({data:{id:'ci-id',order_number:'CI-1',total:'123.45',amount:'123.45',is_paid:false,status:'pending_payment',razorpay_order_id:null},error:null});
  db.save.mockResolvedValue({data:[{razorpay_order_id:'rp-created'}],error:null});
  db.update.mockReturnValue({eq:()=>({is:()=>({select:db.save})})});
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
for(const [name,handler,idField] of [['order',order,'orderId'],['membership',membership,'membershipId']] as const) {
  const request=(body:unknown)=>new NextRequest(`http://localhost/api/razorpay/${name}`,{method:'POST',body:JSON.stringify(body)});
  describe(`${name} payment creation`,()=>{
    it('fails closed without provider credentials',async()=>{vi.stubEnv('RAZORPAY_KEY_ID','');expect((await handler(request({[idField]:'ci-id'}))).status).toBe(503);expect(network).not.toHaveBeenCalled();});
    it('rejects malformed JSON or missing order identifiers',async()=>{expect((await handler(new NextRequest('http://localhost',{method:'POST',body:'{'}))).status).toBe(400);expect((await handler(request({}))).status).toBe(400);expect((await handler(request({[idField]:123}))).status).toBe(400);});
    it('rejects missing database record',async()=>{db.read.mockResolvedValue({data:null,error:null});expect((await handler(request({[idField]:'ci-id'}))).status).toBe(404);});
    it('rejects expired/cancelled orders before calling provider',async()=>{db.read.mockResolvedValue({data:{status:'cancelled'}});expect((await handler(request({[idField]:'ci-id'}))).status).toBe(409);expect(network).not.toHaveBeenCalled();});
    it('rejects invalid amount',async()=>{db.read.mockResolvedValue({data:{status:'pending_payment',total:'NaN',amount:'NaN'}});expect((await handler(request({[idField]:'ci-id'}))).status).toBe(400);});
    it('reuses an existing provider order without network creation',async()=>{db.read.mockResolvedValue({data:{status:'pending_payment',total:123.45,amount:123.45,razorpay_order_id:'rp-existing'}});expect((await (await handler(request({[idField]:'ci-id'}))).json()).razorpayOrderId).toBe('rp-existing');expect(network).not.toHaveBeenCalled();});
    it('uses stored price instead of caller supplied amount',async()=>{const response=await handler(request({[idField]:'ci-id',amount:1}));expect(response.status).toBe(200);const sent=JSON.parse(network.mock.calls[0][1].body);expect(sent.amount).toBe(12345);expect(sent.currency).toBe('INR');expect(db.update).toHaveBeenCalledWith({razorpay_order_id:'rp-created'});});
    it('does not expose a payment window when persistence fails',async()=>{db.save.mockResolvedValue({data:null,error:{message:'private-db-detail'}});const response=await handler(request({[idField]:'ci-id'}));expect(response.status).toBe(500);expect(await response.text()).not.toContain('private-db-detail');});
    it('uses concurrent winner provider id when conditional write loses',async()=>{db.save.mockResolvedValue({data:[],error:null});db.read.mockResolvedValueOnce({data:{id:'ci-id',status:'pending_payment',total:123.45,amount:123.45}}).mockResolvedValueOnce({data:{razorpay_order_id:'rp-winner'}});const response=await handler(request({[idField]:'ci-id'}));expect(response.status).toBe(200);expect((await response.json()).razorpayOrderId).toBe('rp-winner');});
    it('fails closed if concurrent winner cannot be recovered',async()=>{db.save.mockResolvedValue({data:[],error:null});db.read.mockResolvedValueOnce({data:{id:'ci-id',status:'pending_payment',total:123.45,amount:123.45}}).mockResolvedValueOnce({data:null});expect((await handler(request({[idField]:'ci-id'}))).status).toBe(500);});
    it('provider rejection is a retryable upstream error',async()=>{network.mockResolvedValue(new Response('{}',{status:500}));expect((await handler(request({[idField]:'ci-id'}))).status).toBe(502);expect(db.save).not.toHaveBeenCalled();});
  });
}
it('already paid shop order cannot create another payment',async()=>{db.read.mockResolvedValue({data:{is_paid:true}});const response=await order(new NextRequest('http://localhost',{method:'POST',body:'{"orderId":"ci-id"}'}));expect(response.status).toBe(409);expect(network).not.toHaveBeenCalled();});
