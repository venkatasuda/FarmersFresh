"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Adds the caller to a product's back-in-stock list. The database captures the
 * logged-in user (and their account email) automatically; a guest passes an
 * email or phone. De-duplication and validation happen server-side.
 */
export async function watchStock(
  productId: string,
  contact?: { email?: string; phone?: string }
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("watch_stock", {
    p_product: productId,
    p_email: contact?.email || null,
    p_phone: contact?.phone || null,
  });
  if (error) return { ok: false, message: "Couldn't add you just now. Try again." };
  const d = (data ?? {}) as { ok?: boolean; message?: string };
  return { ok: !!d.ok, message: d.message ?? (d.ok ? "Done." : "Please try again.") };
}
