import "server-only";
import type { SubResult } from "@/lib/contracts/shop-subscribe";
import { createClient } from "@/server/supabase/server";

/**
 * Subscribes the logged-in customer to a product on a schedule. Delivery
 * details come from their default saved address, falling back to their last
 * order — so subscribing is one tap once they've ordered or saved an address.
 */
export async function createSubscription(
  productId: string,
  quantity: number,
  frequency: "daily" | "weekly" | "monthly"
): Promise<SubResult> {
  // Address lookup, phone check and first-delivery date live in the database
  // (create_subscription), so web and mobile behave identically.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_subscription", {
    p_product: productId,
    p_quantity: quantity,
    p_frequency: frequency,
  });
  if (error) return { ok: false, message: "Couldn't set up the subscription." };
  const d = (data ?? {}) as { ok?: boolean; message?: string };
  return d.ok ? { ok: true } : { ok: false, message: d.message ?? "Couldn't set up the subscription." };
}
