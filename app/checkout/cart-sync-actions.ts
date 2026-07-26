"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Remembers a logged-in customer's basket so we can remind them if they leave
 * without ordering. No-ops for guests (the DB function checks auth). We store a
 * count + subtotal only — enough for a useful nudge, not a copy of the cart.
 */
export async function saveCart(itemCount: number, subtotal: number): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("save_cart", {
      p_item_count: Math.max(0, Math.floor(itemCount)),
      p_subtotal: Number.isFinite(subtotal) ? subtotal : 0,
    });
  } catch {
    /* best-effort; never block checkout */
  }
}

/** Clears the saved cart once an order is placed (or the basket is emptied). */
export async function clearCart(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("clear_cart");
  } catch {
    /* ignore */
  }
}
