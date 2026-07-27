"use server";

import { createClient } from "@/lib/supabase/server";

export type MyCoupon = {
  code: string;
  kind: string;
  value: number;
  maxDiscount: number | null;
  minSubtotal: number;
  expiresAt: string | null;
};

export async function getMyCoupons(): Promise<MyCoupon[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_coupons");
  return ((data ?? []) as Record<string, unknown>[]).map((c) => ({
    code: String(c.code ?? ""),
    kind: String(c.kind ?? "flat"),
    value: Number(c.value ?? 0),
    maxDiscount: c.max_discount == null ? null : Number(c.max_discount),
    minSubtotal: Number(c.min_subtotal ?? 0),
    expiresAt: (c.expires_at as string | null) ?? null,
  }));
}
