import { createClient } from "@/lib/supabase/server";

export type ShopProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  unit: "kg" | "piece";
  salePrice: number;
  imagePath: string | null;
  category: string | null;
  minOrderQty: number;
  stepQty: number;
  /**
   * A boolean, not a quantity — `catalogue_stock` deliberately exposes only
   * whether something is buyable. Customers don't need to know you have 4.5 kg
   * left, and competitors definitely don't.
   */
  inStock: boolean;
};

type ProductRow = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  unit: "kg" | "piece";
  sale_price: number | string | null;
  image_path: string | null;
  category: string | null;
  min_order_qty: number | string;
  step_qty: number | string;
};

/**
 * Postgres `numeric` arrives over PostgREST as a STRING, not a number, because
 * a JS float cannot hold every numeric value exactly. Money must therefore be
 * converted deliberately — `price * qty` on a string silently gives NaN or
 * string concatenation, and you find out from a customer.
 */
function num(value: number | string | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function toProduct(r: ProductRow, inStock: boolean): ShopProduct | null {
  if (!r.slug || r.sale_price === null) return null;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    unit: r.unit,
    salePrice: num(r.sale_price),
    imagePath: r.image_path,
    category: r.category,
    minOrderQty: num(r.min_order_qty, 0.5),
    stepQty: num(r.step_qty, 0.5),
    inStock,
  };
}

/**
 * Availability, keyed by product id.
 *
 * A separate query rather than a join because `catalogue_stock` is a view over
 * the movement ledger — joining it into the product select would make PostgREST
 * aggregate on every request for no benefit at this size.
 */
async function getStockMap(): Promise<Map<string, boolean>> {
  const supabase = await createClient();
  // An RPC, not a table read: `catalogue_stock()` is SECURITY DEFINER so it
  // can see the private stock ledger and return only a boolean per product.
  const { data, error } = await supabase.rpc("catalogue_stock");

  if (error) {
    // If availability can't be read, fail CLOSED — show everything as out of
    // stock rather than taking orders we might not be able to fill.
    console.error("getStockMap failed:", error.message);
    return new Map();
  }

  return new Map(
    ((data ?? []) as { product_id: string; in_stock: boolean }[]).map((r) => [
      r.product_id,
      r.in_stock === true,
    ])
  );
}

const SELECT =
  "id, slug, name, description, unit, sale_price, image_path, category, min_order_qty, step_qty";

/**
 * The catalogue. Read with the anon key — RLS policy `prod_public_read` is
 * what limits this to published products of a storefront-enabled org, so
 * there is no org filter in the query itself and none is needed.
 */
export async function getCatalogue(): Promise<ShopProduct[]> {
  const supabase = await createClient();

  const [{ data, error }, stock] = await Promise.all([
    supabase
      .from("products")
      .select(SELECT)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    getStockMap(),
  ]);

  if (error) {
    console.error("getCatalogue failed:", error.message);
    return [];
  }

  return ((data ?? []) as ProductRow[])
    .map((r) => toProduct(r, stock.get(r.id) ?? false))
    .filter((p): p is ShopProduct => p !== null);
}

export async function getProductBySlug(
  slug: string
): Promise<ShopProduct | null> {
  const supabase = await createClient();

  const [{ data, error }, stock] = await Promise.all([
    supabase.from("products").select(SELECT).eq("slug", slug).maybeSingle(),
    getStockMap(),
  ]);

  if (error || !data) return null;
  const row = data as ProductRow;
  return toProduct(row, stock.get(row.id) ?? false);
}

export function formatRupees(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatQty(qty: number, unit: "kg" | "piece"): string {
  if (unit === "piece") return `${qty} pc`;
  return qty < 1 ? `${qty * 1000} g` : `${qty} kg`;
}
