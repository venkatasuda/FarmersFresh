/**
 * SERVER ONLY — imports the Supabase server client. See `lib/shop.ts`.
 */
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";
import type { StockLine, StockMovement } from "@/lib/types";

/**
 * On-hand per product at the locations the caller can see.
 *
 * Products with no movements ever recorded won't appear in `stock_on_hand`
 * (there is nothing to sum), so this starts from `products` and left-joins.
 * Otherwise a cut you've never stocked would silently vanish from the screen
 * instead of showing a very informative zero.
 */
export async function getStockLines(): Promise<StockLine[]> {
  const supabase = await createClient();

  const [products, onHand] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, unit, sort_order, is_published")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("stock_on_hand").select("product_id, location_id, quantity"),
  ]);

  if (products.error) {
    console.error("getStockLines products failed:", products.error.message);
    return [];
  }

  const qty = new Map<string, number>();
  const loc = new Map<string, string>();
  for (const r of (onHand.data ?? []) as {
    product_id: string;
    location_id: string;
    quantity: string | number;
  }[]) {
    qty.set(r.product_id, num(r.quantity));
    loc.set(r.product_id, r.location_id);
  }

  return (
    (products.data ?? []) as {
      id: string;
      name: string;
      unit: "kg" | "piece";
      is_published: boolean;
    }[]
  ).map((p) => ({
    productId: p.id,
    name: p.name,
    unit: p.unit,
    isPublished: p.is_published,
    onHand: qty.get(p.id) ?? 0,
    locationId: loc.get(p.id) ?? null,
  }));
}

/** Recent ledger entries, so staff can see what changed and who changed it. */
export async function getRecentMovements(
  limit = 25
): Promise<StockMovement[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("stock_movements")
    .select("id, product_id, delta, reason, note, created_at, products(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getRecentMovements failed:", error.message);
    return [];
  }

  type Row = {
    id: number;
    product_id: string;
    delta: string | number;
    reason: string;
    note: string | null;
    created_at: string;
    products: { name: string } | { name: string }[] | null;
  };

  return ((data ?? []) as Row[]).map((r) => {
    const p = Array.isArray(r.products) ? r.products[0] : r.products;
    return {
      id: String(r.id),
      productName: p?.name ?? "Unknown",
      delta: num(r.delta),
      reason: r.reason,
      note: r.note,
      createdAt: r.created_at,
    };
  });
}

/** The store this shop dispatches from — where stock is counted. */
export async function getStorefrontLocationId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("storefront_location_id")
    .not("storefront_location_id", "is", null)
    .maybeSingle();

  return (data as { storefront_location_id: string } | null)
    ?.storefront_location_id ?? null;
}
