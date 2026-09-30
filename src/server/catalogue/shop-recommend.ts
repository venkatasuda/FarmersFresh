import "server-only";
import type { MiniProduct } from "@/lib/contracts/shop-recommend";
import type { ShopProduct } from "@/lib/types";
import { getCartRecommendations, getProductsByIds } from "@/server/catalogue/storefront";

/**
 * Products the visitor recently looked at. The ids come from the browser's
 * localStorage (their own history, never stored server-side — private by
 * default). The server only turns ids into current product data, applying the
 * same published/stock rules, so a retired or sold-out item quietly drops off.
 */
export async function recentlyViewedProducts(
  ids: string[]
): Promise<ShopProduct[]> {
  const clean = ids.filter((id) => typeof id === "string").slice(0, 8);
  if (clean.length === 0) return [];
  return getProductsByIds(clean);
}

/**
 * Cart-aware complements for the drawer. A server action because the drawer is
 * a client component but the recommendation engine (and its RLS/stock checks)
 * lives on the server. Returns a trimmed shape — the drawer only needs enough
 * to render a mini add-card.
 */

export async function cartRecommendations(
  productIds: string[]
): Promise<MiniProduct[]> {
  const recs: ShopProduct[] = await getCartRecommendations(productIds, 4);
  return recs.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    unit: p.unit,
    salePrice: p.salePrice,
    imagePath: p.imagePath,
    packLabel:
      p.packSize !== null && p.packUnit
        ? p.packUnit === "l"
          ? `${p.packSize} L`
          : `${p.packSize} ${p.packUnit}`
        : null,
    step: p.packSize === null ? (p.stepQty > 0 ? p.stepQty : 0.5) : 1,
    minOrderQty: p.packSize === null ? (p.minOrderQty > 0 ? p.minOrderQty : 0.5) : 1,
  }));
}
