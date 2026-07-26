"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sanitizeError, toAmount } from "@/lib/guard";

export type CouponResult = { ok: true } | { ok: false; message: string };

export async function createCoupon(input: {
  code: string;
  kind: "percent" | "flat";
  value: number;
  maxDiscount: number | null;
  minSubtotal: number;
  perPhoneLimit: number;
  usageLimit: number | null;
  expiresAt: string | null;
}): Promise<CouponResult> {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) {
    return { ok: false, message: "Code must be 3–20 letters or numbers." };
  }
  const value = toAmount(input.value, input.kind === "percent" ? 100 : 1_000_000);
  if (value === null || (input.kind === "percent" && value > 100)) {
    return { ok: false, message: "Enter a valid discount value." };
  }

  const supabase = await createClient();
  const { data: orgId } = await supabase.rpc("current_org_id");
  if (!orgId) return { ok: false, message: "Not signed in." };

  const { error } = await supabase.from("coupons").insert({
    org_id: orgId,
    code,
    kind: input.kind,
    value,
    max_discount: input.maxDiscount,
    min_subtotal: input.minSubtotal,
    per_phone_limit: input.perPhoneLimit,
    usage_limit: input.usageLimit,
    expires_at: input.expiresAt,
  });

  if (error) {
    return {
      ok: false,
      message: error.message.includes("duplicate")
        ? "A coupon with that code already exists."
        : sanitizeError(error.message),
    };
  }

  revalidatePath("/dashboard/coupons");
  return { ok: true };
}

export async function toggleCoupon(
  id: string,
  active: boolean
): Promise<CouponResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("coupons")
    .update({ is_active: active })
    .eq("id", id);
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/coupons");
  return { ok: true };
}
