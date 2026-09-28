"use server";

import { createClient } from "@/lib/supabase/server";
import { getProductsByIds } from "@/lib/shop";
import type { ShopProduct } from "@/lib/types";

/** Products the logged-in customer has bought before and can re-add. */
export async function getReorderProducts(): Promise<ShopProduct[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("my_reorder_products", {
    p_limit: 10,
  });
  if (error || !Array.isArray(data)) return [];

  const ids = (data as unknown[])
    .map((r) =>
      typeof r === "string"
        ? r
        : r && typeof r === "object"
          ? String(Object.values(r as Record<string, unknown>)[0] ?? "")
          : ""
    )
    .filter(Boolean);

  return getProductsByIds(ids);
}
