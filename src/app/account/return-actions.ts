"use server";

import { createClient } from "@/lib/supabase/server";

/** Customer raises an issue on one of their delivered orders. */
export async function requestReturn(
  orderNumber: string,
  reason: string
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_return", {
    p_number: orderNumber,
    p_reason: reason,
  });
  if (error) return { ok: false, message: "Couldn't submit just now. Try again." };
  const d = (data ?? {}) as { ok?: boolean; message?: string };
  return { ok: !!d.ok, message: d.message ?? (d.ok ? "Submitted." : "Please try again.") };
}
