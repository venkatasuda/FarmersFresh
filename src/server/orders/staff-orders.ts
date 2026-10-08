import "server-only";
import type { ActionResult } from "@/lib/contracts/staff-orders";
import { isUuid, sanitizeError, toAmount } from "@/lib/guard";
import type { OrderStatus } from "@/lib/types";
import { createClient } from "@/server/supabase/server";
import { revalidatePath } from "next/cache";
import { refundOrder } from "@/server/payments/refund";

export async function refundOriginalPayment(orderId: string): ReturnType<typeof refundOrder> {
  const result = await refundOrder(orderId);
  revalidatePath("/dashboard/orders");
  return result;
}

/** Instantly credit loyalty points to a customer's balance for an order. */
export async function instantRefund(
  orderId: string,
  points: number,
  reason: string
): Promise<{ ok: boolean; message?: string }> {
  if (!isUuid(orderId) || typeof points !== "number" || toAmount(points) !== points) return { ok: false, message: "Refund exceeds collected payment." };
  if (typeof reason !== "string" || reason.length > 500) return { ok: false, message: "Keep the note within 500 characters." };
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
