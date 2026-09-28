/**
 * SERVER ONLY — imports the Supabase server client. See `lib/shop.ts`.
 * Data for the counter POS: the sellable product list with live stock.
 */
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";
import type { PosProduct } from "@/lib/types";

/**
 * Everything the till can ring up — active products (published or not, because
 * the counter sells things that may not be online), with current on-hand so
 * staff can see what's short. Loose items carry their per-kg price; packs
 * carry the pack price. Staff can override either at the point of sale.
 */
export async function getPosProducts(): Promise<PosProduct[]> {
  const supabase = await createClient();

  const [{ data, error }, stock] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, unit, sale_price, pack_size, pack_unit, category, category_slug")
      .eq("is_active", true)
      .order("category_slug", { ascending: true })
      .order("sort_order", { ascending: true }),
    supabase.from("stock_on_hand").select("product_id, quantity"),
  ]);

  if (error) {
    console.error("getPosProducts failed:", error.message);
    return [];
  }

  const onHand = new Map(
    ((stock.data ?? []) as { product_id: string; quantity: string | number }[]).map(
      (r) => [r.product_id, num(r.quantity)]
    )
  );

  return (
    (data ?? []) as {
      id: string;
      name: string;
      unit: "kg" | "piece";
      sale_price: string | number | null;
      pack_size: string | number | null;
      pack_unit: PosProduct["packUnit"];
      category: string | null;
    }[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    salePrice: r.sale_price === null ? 0 : num(r.sale_price),
    packSize: r.pack_size === null ? null : num(r.pack_size),
    packUnit: r.pack_unit,
    category: r.category,
    onHand: onHand.get(r.id) ?? 0,
  }));
}
