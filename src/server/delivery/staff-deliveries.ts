import "server-only";
import { isUuid, sanitizeError } from "@/lib/guard";
import type { OrderStatus } from "@/lib/types";
import { createClient } from "@/server/supabase/server";
import { revalidatePath } from "next/cache";

type Res = { ok: true } | { ok: false; message: string };

/** A rider claims (take=true) or hands off (take=false) a delivery. */
export async function claimDelivery(orderId: string, take: boolean): Promise<Res> {
  if (!isUuid(orderId) || typeof take !== "boolean") return { ok:false,message:"Choose a delivery." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_delivery", {
    p_order_id: orderId,
    p_take: take,
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/deliveries");
  return { ok: true };
}

/** Move a delivery forward: out_for_delivery, then delivered. */
export async function setDeliveryStatus(
  orderId: string,
  status: OrderStatus
): Promise<Res> {
  if (!isUuid(orderId) || !["out_for_delivery","delivered"].includes(status)) return { ok:false,message:"Choose a valid delivery status." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_status", { p_order_id: orderId, p_to: status });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/deliveries");
  revalidatePath("/dashboard/orders");
  return { ok: true };
}

/** Push the assigned rider's live GPS and report whether it was saved. */
export async function updateRiderLocation(
  orderId: string,
  lat: number,
  lng: number,
  eta?: number
): Promise<Res> {
  if (!isUuid(orderId) || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180
    || (eta!==undefined && (!Number.isInteger(eta) || eta<0 || eta>1440))) return { ok:false,message:"Invalid location or ETA." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_rider_location", {
    p_order_id: orderId,
    p_lat: lat,
    p_lng: lng,
    p_eta: eta ?? null,
  });
  return error ? { ok:false,message:sanitizeError(error.message) } : { ok:true };
}

/** Rider marks themselves available/unavailable for auto-assignment. */
export async function setShift(on: boolean): Promise<Res> {
  if (typeof on!=="boolean") return { ok:false,message:"Choose a shift status." };
  const supabase = await createClient();
  const { error }=await supabase.rpc("set_my_shift", { p_on: on });
  if (error) return { ok:false,message:sanitizeError(error.message) };
  revalidatePath("/dashboard/deliveries");
  return { ok:true };
}

export async function reportDeliveryFailure(orderId:string,note:string):Promise<Res> {
  if (!isUuid(orderId) || typeof note!=="string" || !note.trim() || note.length>500)
    return { ok:false,message:"Give a delivery failure reason within 500 characters." };
  const supabase=await createClient();
  const { error }=await supabase.rpc("report_delivery_failure",{p_order_id:orderId,p_note:note.trim()});
  if (error) return { ok:false,message:sanitizeError(error.message) };
  revalidatePath("/dashboard/deliveries"); revalidatePath("/dashboard/orders");
  return { ok:true };
}

export async function receiveFailedDelivery(orderId:string):Promise<Res> {
  if (!isUuid(orderId)) return { ok:false,message:"Choose a delivery." };
  const supabase=await createClient();
  const { error }=await supabase.rpc("receive_failed_delivery",{p_order_id:orderId});
  if (error) return { ok:false,message:sanitizeError(error.message) };
  revalidatePath("/dashboard/deliveries"); revalidatePath("/dashboard/orders");
  return { ok:true };
}

/** Owner button: push unclaimed orders to on-shift riders now. */
export async function autoAssign(): Promise<
  { ok: true; count: number } | { ok: false; message: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("auto_assign_deliveries");
  if (error) return { ok: false, message: "Couldn't auto-assign — check on-shift riders." };
  revalidatePath("/dashboard/deliveries");
  return { ok: true, count: Number(data ?? 0) };
}
