"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStorefrontLocationId } from "@/lib/stock";
import { sanitizeError } from "@/lib/guard";

export async function recordProduction(
  items: { productId: string; qty: number; expiry?: string }[]
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const rows = items.filter((i) => i.qty > 0);
  if (rows.length === 0) return { ok: false, message: "Enter at least one quantity to produce." };
  const locationId = await getStorefrontLocationId();
  if (!locationId) return { ok: false, message: "No dispatch store is set." };

  const supabase = await createClient();
  for (const r of rows) {
    const { error } = await supabase.rpc("record_production", {
      p_location: locationId,
      p_product: r.productId,
      p_qty: r.qty,
      p_expiry: r.expiry || null,
      p_note: "Production plan",
    });
    if (error) return { ok: false, message: sanitizeError(error.message) };
  }
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard/expiry");
  revalidatePath("/");
  return { ok: true, count: rows.length };
}
