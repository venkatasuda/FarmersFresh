"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "./product-card";
import { readRecentlyViewed } from "./track-view";
import { recentlyViewedProducts } from "./recommend-actions";
import type { ShopProduct } from "@/lib/types";

/**
 * "Recently viewed" row for the home page. Client-side because the history
 * lives in the visitor's own localStorage; it asks the server to turn those
 * ids into current product data. Renders nothing until there are at least two
 * items, so a first-time visitor never sees an empty rail.
 *
 * `excludeId` lets a product page hide the item you're already looking at.
 */
export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const [products, setProducts] = useState<ShopProduct[]>([]);

  useEffect(() => {
    const ids = readRecentlyViewed().filter((id) => id !== excludeId);
    if (ids.length < 2) return;
    let cancelled = false;
    recentlyViewedProducts(ids).then((p) => {
      if (!cancelled) setProducts(p);
    });
    return () => {
      cancelled = true;
    };
  }, [excludeId]);

  if (products.length < 2) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-ink">
        Recently viewed
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {products.slice(0, 4).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
