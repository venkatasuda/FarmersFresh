"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sanitizeError } from "@/lib/guard";

export type DeliveryResult = { ok: true } | { ok: false; message: string };

export async function claimDelivery(
  orderId: string,
  take: boolean
): Promise<DeliveryResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_delivery", {
    p_order_id: orderId,
    p_take: take,
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/deliveries");
  revalidatePath("/dashboard/orders");
  return { ok: true };
}

/**
 * Push the rider's live GPS (and optionally an ETA) to the order, so the
 * customer's track page can show a moving marker. Best-effort — a dropped
 * update just means the marker doesn't move that tick.
 */
export async function updateRiderLocation(
  orderId: string,
  lat: number,
  lng: number,
  etaMinutes?: number
): Promise<DeliveryResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, message: "No location." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_rider_location", {
    p_order_id: orderId,
    p_lat: lat,
    p_lng: lng,
    p_eta: Number.isFinite(etaMinutes) ? etaMinutes : null,
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  return { ok: true };
}

/**
 * Advance a delivery's status. Reuses the same orders update the order queue
 * uses, so the customer's status notifications fire from one place.
 */
export async function setDeliveryStatus(
  orderId: string,
  status: "out_for_delivery" | "delivered"
): Promise<DeliveryResult> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "delivered") patch.delivered_at = new Date().toISOString();

  const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
  if (error) return { ok: false, message: sanitizeError(error.message) };

  revalidatePath("/dashboard/deliveries");
  revalidatePath("/dashboard/orders");
  return { ok: true };
}
