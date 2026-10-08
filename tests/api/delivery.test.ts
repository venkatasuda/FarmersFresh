import { afterEach, expect, it, vi } from "vitest";
import { setShift, updateRiderLocation, setDeliveryStatus } from "@/server/delivery/staff-deliveries";

const rpc=vi.hoisted(()=>vi.fn());
vi.mock("@/server/supabase/server",()=>({createClient:()=>({rpc})}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
afterEach(()=>vi.clearAllMocks());

it("reports failed shift and location saves without leaking database details",async()=>{
  rpc.mockResolvedValue({error:{message:'private SQL table details'},data:null});
  expect(await setShift(true)).toEqual({ok:false,message:'Something went wrong. Please try again.'});
  expect(await updateRiderLocation('11111111-1111-4111-8111-111111111111',17,78,10)).toMatchObject({ok:false});
  rpc.mockResolvedValue({error:null,data:true});
  expect(await setShift(true)).toEqual({ok:true});
});

it("rejects invalid GPS and unsupported rider transitions before invoking the database",async()=>{
  expect(await updateRiderLocation('11111111-1111-4111-8111-111111111111',NaN,78)).toMatchObject({ok:false});
  expect(await setDeliveryStatus('11111111-1111-4111-8111-111111111111','cancelled')).toMatchObject({ok:false});
  expect(rpc).not.toHaveBeenCalled();
});
