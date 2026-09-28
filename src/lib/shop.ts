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
  diet_tags: string[] | null;
};

type Rating = { avg: number; count: number };

/** Average rating + count keyed by product id. */
async function getRatingsMap(): Promise<Map<string, Rating>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("product_ratings");
  if (error) return new Map();
  return new Map(
    (
      (data ?? []) as {
        product_id: string;
        avg_rating: number | string;
        review_count: number | string;
      }[]
    ).map((r) => [
      r.product_id,
      { avg: num(r.avg_rating), count: num(r.review_count) },
    ])
  );
}

function toProduct(
  r: ProductRow,
  stock: { inStock: boolean; low: boolean } | undefined,
  rating?: Rating,
  isBestseller = false
): ShopProduct | null {
  const inStock = stock?.inStock ?? false;
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
    lowStock: inStock && (stock?.low ?? false),
    isBestseller,
    avgRating: rating && rating.count > 0 ? rating.avg : null,
    reviewCount: rating?.count ?? 0,
    dietTags: r.diet_tags ?? [],
  };
}

const SELECT =
  "id, slug, name, description, unit, sale_price, compare_at_price, badge, brand, pack_size, pack_unit, image_path, category, category_slug, min_order_qty, step_qty, diet_tags, brands(slug, name, tagline)";

/**
 * Availability, keyed by product id.
 *
 * An RPC, not a table read: `catalogue_stock()` is SECURITY DEFINER so it can
 * see the private stock ledger and return only a boolean per product.
 */
type Stock = { inStock: boolean; low: boolean };

/** The shop's current best-selling product ids (last 30 days). */
async function getBestsellerSet(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("bestseller_ids", { p_limit: 8 });
  return new Set(idsFromRpc(data));
}

async function getStockMap(): Promise<Map<string, Stock>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catalogue_stock");

  if (error) {
    // If availability can't be read, fail CLOSED — show everything as sold out
    // rather than taking orders we might not be able to fill.
    console.error("catalogue_stock failed:", error.message);
    return new Map();
  }

  return new Map(
    ((data ?? []) as { product_id: string; in_stock: boolean; low: boolean }[]).map(
      (r) => [r.product_id, { inStock: r.in_stock === true, low: r.low === true }]
    )
  );
}

/**
 * The catalogue. Read with the anon key — the RLS policy `prod_public_read` is
 * what limits this to published products of a storefront-enabled org, so there
 * is no org filter in the query and none is needed.
 */
export async function getCatalogue(): Promise<ShopProduct[]> {
  const supabase = await createClient();

  const [{ data, error }, stock, ratings, best] = await Promise.all([
    supabase
      .from("products")
      .select(SELECT)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    getStockMap(),
    getRatingsMap(),
    getBestsellerSet(),
  ]);

  if (error) {
    console.error("getCatalogue failed:", error.message);
    return [];
  }

  return ((data ?? []) as ProductRow[])
    .map((r) => toProduct(r, stock.get(r.id), ratings.get(r.id), best.has(r.id)))
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

  const [{ data, error }, stock, ratings, best] = await Promise.all([
    supabase.from("products").select(SELECT).in("id", ids),
    getStockMap(),
    getRatingsMap(),
    getBestsellerSet(),
  ]);

  if (error) {
    console.error("getCatalogueByCategory failed:", error.message);
    return [];
  }

  const order = new Map(ids.map((id, i) => [id, i]));

  return ((data ?? []) as ProductRow[])
    .map((r) => toProduct(r, stock.get(r.id), ratings.get(r.id), best.has(r.id)))
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

/** Fetch specific products by id, preserving the given order. Used by the
 *  recommendation surfaces, which get an ordered list of ids from the engine. */
export async function getProductsByIds(
  ids: string[]
): Promise<ShopProduct[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();

  const [{ data, error }, stock, ratings] = await Promise.all([
    supabase.from("products").select(SELECT).in("id", ids),
    getStockMap(),
    getRatingsMap(),
  ]);

  if (error) return [];
  const order = new Map(ids.map((id, i) => [id, i]));

  return ((data ?? []) as ProductRow[])
    .map((r) => toProduct(r, stock.get(r.id), ratings.get(r.id)))
    .filter((p): p is ShopProduct => p !== null)
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/**
 * A `setof uuid` RPC returns an array of scalar strings via PostgREST, but be
 * defensive: some setups wrap each in an object. Extract a plain id list.
 */
function idsFromRpc(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) =>
      typeof row === "string"
        ? row
        : row && typeof row === "object"
          ? String(Object.values(row as Record<string, unknown>)[0] ?? "")
          : ""
    )
    .filter(Boolean);
}

/** "Frequently bought together" for a product. */
export async function getFrequentlyBoughtTogether(
  productId: string,
  limit = 4
): Promise<ShopProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("frequently_bought_together", {
    p_product: productId,
    p_limit: limit,
  });
  if (error) return [];
  return getProductsByIds(idsFromRpc(data));
}

/** Complements for a whole basket. */
export async function getCartRecommendations(
  productIds: string[],
  limit = 6
): Promise<ShopProduct[]> {
  if (productIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cart_recommendations", {
    p_products: productIds,
    p_limit: limit,
  });
  if (error) return [];
  return getProductsByIds(idsFromRpc(data));
}

/** Fraction off, 0 when a product isn't discounted. */
function discountFraction(p: ShopProduct): number {
  if (p.compareAtPrice === null || p.compareAtPrice <= p.salePrice) return 0;
  return (p.compareAtPrice - p.salePrice) / p.compareAtPrice;
}

function isOnSale(p: ShopProduct): boolean {
  return p.compareAtPrice !== null && p.compareAtPrice > p.salePrice;
}

/**
 * This week's deals — every on-sale product, biggest markdown first. "On sale"
 * simply means a compare-at price above the selling price, so the owner creates
 * a deal by setting a strike-through price on the product; nothing else to
 * manage. In-stock items are shown before sold-out ones at equal discount.
 */
export async function getOffers(): Promise<ShopProduct[]> {
  const all = await getCatalogue();
  return all
    .filter(isOnSale)
    .sort((a, b) => {
      const d = discountFraction(b) - discountFraction(a);
      if (d !== 0) return d;
      return Number(b.inStock) - Number(a.inStock);
    });
}

/**
 * "Picked for you" — deals on things this customer has actually bought before.
 * Reuses the buy-it-again history (my_reorder_products) and keeps only the ones
 * currently on offer. Empty for guests or when none of their items are on sale,
 * so the page can fall back to the general deals.
 */
export async function getPersonalOffers(limit = 8): Promise<ShopProduct[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase.rpc("my_reorder_products", { p_limit: 30 });
  const ids = idsFromRpc(data);
  if (ids.length === 0) return [];

  const prods = await getProductsByIds(ids);
  return prods.filter(isOnSale).slice(0, limit);
}

/** Products the logged-in customer is about due to run out of. */
export async function getRefillSuggestions(): Promise<ShopProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("refill_suggestions");
  return getProductsByIds(idsFromRpc(data));
}

/** A personalised feed ranked by the customer's own category habits. */
export async function getPersonalizedProducts(limit = 10): Promise<ShopProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("personalized_products", { p_limit: limit });
  return getProductsByIds(idsFromRpc(data));
}

export async function getProductBySlug(
  slug: string
): Promise<ShopProduct | null> {
  const supabase = await createClient();

  const [{ data, error }, stock, ratings] = await Promise.all([
    supabase.from("products").select(SELECT).eq("slug", slug).maybeSingle(),
    getStockMap(),
    getRatingsMap(),
  ]);

  if (error || !data) return null;
  const row = data as ProductRow;
  return toProduct(row, stock.get(row.id), ratings.get(row.id));
}
