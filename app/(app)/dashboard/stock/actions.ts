"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STOCK_REASONS } from "@/lib/types";

export type StockResult = { ok: true } | { ok: false; message: string };

/**
 * Records a stock movement.
 *
 * The UI sends a positive amount plus a reason; the SIGN is decided here from
 * the reason, not by the caller. Letting a form post "-5" invites a typo that
 * turns a delivery into a write-off, and there is no undo on a ledger — only
 * a correcting entry.
 */
export async function recordStock(
  locationId: string,
  productId: string,
  amount: number,
  reason: string,
  note: string
): Promise<StockResult> {
  const spec = STOCK_REASONS.find((r) => r.value === reason);
  if (!spec) return { ok: false, message: "Pick a reason." };

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Enter an amount greater than zero." };
  }
  if (amount > 1000) {
    return { ok: false, message: "That looks too large — check the amount." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("record_stock", {
    p_location: locationId,
    p_product: productId,
    p_delta: amount * spec.sign,
    p_reason: reason,
    p_note: note.trim() || null,
  });

  if (error) {
    // record_stock raises readable messages for the cases staff can fix
    // (below zero, no access to that location).
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { ok: true };
}
