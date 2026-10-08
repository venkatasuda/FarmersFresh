import { afterEach, expect, it, vi } from "vitest";
import { setStaffAccess } from "@/server/auth/staff-access";
import { approveReturn } from "@/server/orders/staff-returns";
const rpc=vi.hoisted(()=>vi.fn());
vi.mock("@/server/supabase/server",()=>({createClient:()=>({rpc})}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
afterEach(()=>vi.clearAllMocks());
const id="11111111-1111-4111-8111-111111111111";
it("never silently approves malformed wallet compensation as zero",async()=>{
  for (const amount of [NaN,Infinity,-1,1.001,null]) expect(await approveReturn(id,amount as number)).toMatchObject({ok:false});
  expect(await approveReturn("bad",0)).toMatchObject({ok:false});
  expect(await approveReturn(id,0,"x".repeat(501))).toMatchObject({ok:false});
  expect(rpc).not.toHaveBeenCalled();
});
it("validates staff assignment inputs and hides database details",async()=>{
  expect(await setStaffAccess("bad",id,"staff","Reason")).toMatchObject({ok:false});
  expect(await setStaffAccess(id,id,"owner" as "staff","Reason")).toMatchObject({ok:false});
  expect(await setStaffAccess(id,id,null," ")).toMatchObject({ok:false});
  expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValue({error:{message:"private SQL relation"}});
  expect(await setStaffAccess(id,id,"staff","Reason")).toEqual({ok:false,message:"Something went wrong. Please try again."});
  rpc.mockResolvedValue({error:null});
  expect(await setStaffAccess(id,id,null,"Reason")).toEqual({ok:true});
});
