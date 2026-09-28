"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductCard } from "@/app/(shop)/product-card";
import { useWishlist } from "@/app/(shop)/wishlist-context";
import { recentlyViewedProducts } from "@/app/(shop)/recommend-actions";
import type { ShopProduct } from "@/lib/types";

/**
 * The saved list. Reads favourite ids from the wishlist context and asks the
 * server to turn them into current products (applying the same published/stock
 * rules, so a retired item drops off). Re-fetches when the set changes.
 */
export function WishlistClient() {
  const { ids, ready } = useWishlist();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const key = ids.join(",");

  useEffect(() => {
    if (!ready) return;
    if (ids.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    // recentlyViewedProducts is just "products by id" — reused here.
    recentlyViewedProducts(ids).then((p) => {
      if (!cancelled) {
        setProducts(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  if (!ready || loading) {
    return (
      <p className="py-16 text-center text-sm text-ink-soft">Loading…</p>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
        <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-brand-50">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="#86efac" strokeWidth="1.8">
            <path d="M12 20s-7-4.35-9.2-8.4C1.3 8.9 2.6 5.5 5.8 5.1 7.8 4.85 9.4 6 12 8.6c2.6-2.6 4.2-3.75 6.2-3.5 3.2.4 4.5 3.8 3 6.5C19 15.65 12 20 12 20Z" strokeLinejoin="round" />
          </svg>
        </span>
        <h1 className="text-lg font-medium text-ink">Your favourites are empty</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-ink-soft">
          Tap the heart on any product to save it here for later.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-5 flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink">
        <span className="h-6 w-1.5 rounded-full bg-brand-500" />
        Your favourites
        <span className="text-base font-normal text-ink-soft">
          ({products.length})
        </span>
      </h1>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </>
  );
}
