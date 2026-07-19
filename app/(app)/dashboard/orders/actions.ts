"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; message: string };

const ALLOWED: OrderStatus[] = [
  "confirmed",
  "packed",
  "out_for_delivery",
  "delivered",
];

export async function advanceOrder(
  orderId: string,
  to: OrderStatus
): Promise<ActionResult> {
  if (!ALLOWED.includes(to)) {
    return { ok: false, message: "That status can't be set from here." };
  }

  const supabase = await createClient();

  const patch: Record<string, unknown> = { status: to };
  if (to === "confirmed") patch.confirmed_at = new Date().toISOString();
  if (to === "delivered") patch.delivered_at = new Date().toISOString();

  const { error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", orderId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/orders");
  return { ok: true };
}

/**
 * Cancelling goes through the `cancel_order` function rather than a plain
 * UPDATE, because it must also return the reserved meat to the stock ledger.
 * A status change alone would leave that stock permanently invisible.
 */
export async function cancelOrder(
  orderId: string,
  reason: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("cancel_order", {
    p_order_id: orderId,
    p_reason: reason || "Cancelled by staff",
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/orders");
  return { ok: true };
}
