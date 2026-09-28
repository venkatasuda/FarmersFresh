"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sanitizeError } from "@/lib/guard";
import type { OrderStatus } from "@/lib/types";

type Res = { ok: true } | { ok: false; message: string };

/** A rider claims (take=true) or hands off (take=false) a delivery. */
export async function claimDelivery(orderId: string, take: boolean): Promise<Res> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_delivery", {
    p_order_id: orderId,
    p_take: take,
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  const d = data as { ok?: boolean; message?: string } | null;
  if (d && d.ok === false) {
    return { ok: false, message: d.message ?? "Couldn't update this delivery." };
  }
  revalidatePath("/dashboard/deliveries");
  return { ok: true };
}

/** Move a delivery forward: out_for_delivery, then delivered. */
export async function setDeliveryStatus(
  orderId: string,
  status: OrderStatus
): Promise<Res> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "delivered") patch.delivered_at = new Date().toISOString();
  const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/deliveries");
  revalidatePath("/dashboard/orders");
  return { ok: true };
}

/** Push the rider's live GPS (and optional ETA) to the order. Fire-and-forget. */
export async function updateRiderLocation(
  orderId: string,
  lat: number,
  lng: number,
  eta?: number
): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("update_rider_location", {
    p_order_id: orderId,
    p_lat: lat,
    p_lng: lng,
    p_eta: eta ?? null,
  });
}

/** Rider marks themselves available/unavailable for auto-assignment. */
export async function setShift(on: boolean): Promise<boolean> {
  const supabase = await createClient();
  await supabase.rpc("set_my_shift", { p_on: on });
  revalidatePath("/dashboard/deliveries");
  return on;
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
