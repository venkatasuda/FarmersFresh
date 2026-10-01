import "server-only";
import type { MyCoupon } from "@/lib/contracts/account-coupon";
import { createClient } from "@/server/supabase/server";

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
