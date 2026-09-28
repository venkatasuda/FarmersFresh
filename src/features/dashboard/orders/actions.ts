"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/server/supabase/server";
import { sanitizeError } from "@/lib/guard";
import type { OrderStatus } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; message: string };

/** Instantly credit loyalty points to a customer's balance for an order. */
export async function instantRefund(
  orderId: string,
  points: number,
  reason: string
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("instant_refund", {
    p_order_id: orderId,
    p_points: points,
    p_reason: reason || null,
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  const d = (data ?? {}) as { ok?: boolean; message?: string };
  if (!d.ok) return { ok: false, message: d.message ?? "Couldn't refund." };
  revalidatePath("/dashboard/orders");
  return { ok: true };
}

/** Move an order forward. The database enforces the allowed steps (set_order_status). */
export async function advanceOrder(
  orderId: string,
  to: OrderStatus
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_status", { p_order_id: orderId, p_to: to });
  if (error) return { ok: false, message: sanitizeError(error.message) };
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

  if (error) return { ok: false, message: sanitizeError(error.message) };

  revalidatePath("/dashboard/orders");
  return { ok: true };
}
