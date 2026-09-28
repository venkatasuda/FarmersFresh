"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "./product-card";
import type { ShopProduct } from "@/lib/types";

type Sort = "featured" | "price-asc" | "price-desc" | "rating";

/**
 * A product grid with sort + in-stock filter, like the controls on a category
 * page at BigBasket/Amazon. Works on the already-loaded list (client-side), so
 * changing sort or filter is instant with no round trip.
 */
const DIET_FILTERS = [
  { key: "veg", label: "Veg" },
  { key: "non-veg", label: "Non-veg" },
  { key: "vegan", label: "Vegan" },
  { key: "organic", label: "Organic" },
];

export function FilterableGrid({ products }: { products: ShopProduct[] }) {
  const [sort, setSort] = useState<Sort>("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [diet, setDiet] = useState("");

  // Only show diet chips the catalogue actually uses.
  const availableDiets = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) for (const t of p.dietTags) set.add(t);
    return DIET_FILTERS.filter((d) => set.has(d.key));
  }, [products]);

  const shown = useMemo(() => {
    let list = products;
    if (inStockOnly) list = list.filter((p) => p.inStock);
    if (diet) list = list.filter((p) => p.dietTags.includes(diet));
    const copy = [...list];
    switch (sort) {
      case "price-asc":
        copy.sort((a, b) => a.salePrice - b.salePrice);
        break;
      case "price-desc":
        copy.sort((a, b) => b.salePrice - a.salePrice);
        break;
      case "rating":
        copy.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
        break;
      // "featured" keeps the server order.
    }
    return copy;
  }, [products, sort, inStockOnly, diet]);

  return (
    <div>
      {availableDiets.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <Chip active={diet === ""} onClick={() => setDiet("")}>All</Chip>
          {availableDiets.map((d) => (
            <Chip key={d.key} active={diet === d.key} onClick={() => setDiet(d.key)}>
              {d.label}
            </Chip>
          ))}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="size-4 accent-brand-600"
          />
          In stock only
        </label>

        <label className="flex items-center gap-2 text-sm text-ink-soft">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-brand-500"
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="rating">Top rated</option>
          </select>
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-soft">
          Nothing matches that filter.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
        active ? "bg-brand-600 text-white" : "border border-line text-ink-soft hover:bg-brand-50"
      }`}
    >
      {children}
    </button>
  );
}
