/**
 * SERVER ONLY. This module imports the Supabase server client, which imports
 * `next/headers`. Importing it from a Client Component breaks the production
 * build — that is not a lint rule, it is a hard failure.
 *
 * Client Components want `lib/format.ts` and `lib/types.ts` instead.
 */
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";
import type { Category, ShopProduct } from "@/lib/types";

export type { ShopProduct };

type ProductRow = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  unit: "kg" | "piece";
  sale_price: number | string | null;
  compare_at_price: number | string | null;
  badge: string | null;
  brand: string | null;
  brands: { slug: string; name: string; tagline: string | null } | null
        | { slug: string; name: string; tagline: string | null }[];
  pack_size: number | string | null;
  pack_unit: ShopProduct["packUnit"];
  image_path: string | null;
  category: string | null;
  category_slug: string | null;
  min_order_qty: number | string;
  step_qty: number | string;
};

function toProduct(r: ProductRow, inStock: boolean): ShopProduct | null {
  if (!r.slug || r.sale_price === null) return null;
  // PostgREST returns an embedded row as an object or a one-element array
  // depending on how it infers the relationship. Handle both.
  const brand = Array.isArray(r.brands) ? r.brands[0] : r.brands;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    unit: r.unit,
    salePrice: num(r.sale_price),
    compareAtPrice: r.compare_at_price === null ? null : num(r.compare_at_price),
    badge: r.badge,
    brand: brand?.name ?? r.brand,
    brandSlug: brand?.slug ?? null,
    brandTagline: brand?.tagline ?? null,
    packSize: r.pack_size === null ? null : num(r.pack_size),
    packUnit: r.pack_unit,
    imagePath: r.image_path,
    category: r.category,
    categorySlug: r.category_slug,
    minOrderQty: num(r.min_order_qty, 0.5),
    stepQty: num(r.step_qty, 0.5),
    inStock,
  };
}

const SELECT =
  "id, slug, name, description, unit, sale_price, compare_at_price, badge, brand, pack_size, pack_unit, image_path, category, category_slug, min_order_qty, step_qty, brands(slug, name, tagline)";

/**
 * Availability, keyed by product id.
 *
 * An RPC, not a table read: `catalogue_stock()` is SECURITY DEFINER so it can
 * see the private stock ledger and return only a boolean per product.
 */
async function getStockMap(): Promise<Map<string, boolean>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catalogue_stock");

  if (error) {
    // If availability can't be read, fail CLOSED — show everything as sold out
    // rather than taking orders we might not be able to fill.
    console.error("catalogue_stock failed:", error.message);
    return new Map();
  }

  return new Map(
    ((data ?? []) as { product_id: string; in_stock: boolean }[]).map((r) => [
      r.product_id,
      r.in_stock === true,
    ])
  );
}

/**
 * The catalogue. Read with the anon key — the RLS policy `prod_public_read` is
 * what limits this to published products of a storefront-enabled org, so there
 * is no org filter in the query and none is needed.
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

/**
 * Products in a category.
 *
 * Resolves through `catalogue_by_category`, which walks INTO child
 * categories — a plain `where category_slug = 'rice'` would return nothing,
 * because every rice product sits in a subcategory, not the department.
 */
export async function getCatalogueByCategory(
  categorySlug: string
): Promise<ShopProduct[]> {
  const supabase = await createClient();

  const { data: idRows, error: idError } = await supabase.rpc(
    "catalogue_by_category",
    { p_slug: categorySlug }
  );

  if (idError) {
    console.error("catalogue_by_category failed:", idError.message);
    return [];
  }

  const ids = ((idRows ?? []) as { product_id: string }[]).map(
    (r) => r.product_id
  );
  if (ids.length === 0) return [];

  const [{ data, error }, stock] = await Promise.all([
    supabase.from("products").select(SELECT).in("id", ids),
    getStockMap(),
  ]);

  if (error) {
    console.error("getCatalogueByCategory failed:", error.message);
    return [];
  }

  const order = new Map(ids.map((id, i) => [id, i]));

  return ((data ?? []) as ProductRow[])
    .map((r) => toProduct(r, stock.get(r.id) ?? false))
    .filter((p): p is ShopProduct => p !== null)
    // `.in()` does not preserve order, so restore the ordering the SQL chose.
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catalogue_categories");

  if (error) {
    console.error("catalogue_categories failed:", error.message);
    return [];
  }

  return (
    (data ?? []) as {
      id: string;
      parent_id: string | null;
      slug: string;
      name: string;
      icon: string | null;
      product_count: number;
    }[]
  ).map((r) => ({
    id: r.id,
    parentId: r.parent_id,
    slug: r.slug,
    name: r.name,
    icon: r.icon,
    productCount: num(r.product_count),
  }));
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
