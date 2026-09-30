import "server-only";
import { createClient } from "@/server/supabase/server";

export async function getAdminCoupons() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coupons")
    .select("id, code, kind, value, max_discount, min_subtotal, per_phone_limit, used_count, usage_limit, is_active, expires_at")
    .order("created_at", { ascending: false });
  return data ?? [];
}
