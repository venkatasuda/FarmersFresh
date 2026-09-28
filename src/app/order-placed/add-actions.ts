"use server";

import { createClient } from "@/lib/supabase/server";

export async function addToOrder(
  orderNumber: string,
  productId: string,
  quantity: number
): Promise<{ ok: boolean; total?: number; message?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_to_order", {
    p_number: orderNumber,
    p_lines: [{ product_id: productId, quantity }],
  });
  if (error) return { ok: false, message: "Couldn't add that. Try again." };
  const d = (data ?? {}) as { ok?: boolean; total?: number; message?: string };
  if (!d.ok) return { ok: false, message: d.message ?? "Couldn't add that." };
  return { ok: true, total: Number(d.total ?? 0) };
}
