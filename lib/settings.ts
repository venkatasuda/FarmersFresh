/**
 * SERVER ONLY — store settings the shop owner configures. Customer-safe fields
 * only (fee rule, support contact, GST/business details). Falls back to the
 * built-in defaults if the shop hasn't set anything yet, so callers always get
 * usable numbers.
 */
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";
import {
  DELIVERY_FEE,
  FREE_DELIVERY_OVER,
  type StoreSettings,
} from "@/lib/types";

/**
 * The standing "subscribe & save" discount percent (0 if none). Public read,
 * used on the product page to show the incentive to subscribe.
 */
export async function getSubscriptionDiscountPct(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("subscription_discount_pct");
    return num(data, 0);
  } catch {
    return 0;
  }
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const fallback: StoreSettings = {
    name: "Farmers Fresh",
    supportEmail: null,
    supportPhone: null,
    freeDeliveryThreshold: FREE_DELIVERY_OVER,
    deliveryFee: DELIVERY_FEE,
    gstin: null,
    businessAddress: null,
  };

  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_store_settings");
    if (!data) return fallback;
    const d = data as Record<string, unknown>;
    return {
      name: (d.name as string) || fallback.name,
      supportEmail: (d.support_email as string | null) ?? null,
      supportPhone: (d.support_phone as string | null) ?? null,
      freeDeliveryThreshold: num(d.free_delivery_threshold, FREE_DELIVERY_OVER),
      deliveryFee: num(d.delivery_fee, DELIVERY_FEE),
      gstin: (d.gstin as string | null) ?? null,
      businessAddress: (d.business_address as string | null) ?? null,
    };
  } catch {
    return fallback;
  }
}
