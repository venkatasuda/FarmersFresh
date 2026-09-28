"use server";

import { createClient } from "@/lib/supabase/server";

export async function redeemGiftCard(
  code: string
): Promise<{ ok: true; value: number } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_gift_card", { p_code: code });
  if (error) return { ok: false, message: "Couldn't redeem just now. Try again." };
  const d = (data ?? {}) as { ok?: boolean; value?: number; message?: string };
  if (!d.ok) return { ok: false, message: d.message ?? "That code isn't valid." };
  return { ok: true, value: Number(d.value ?? 0) };
}
