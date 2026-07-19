"use client";

import { useState } from "react";
import { useCart } from "./cart-context";
import { formatLineQty, formatRupees } from "@/lib/format";
import { isLoose, packLabel, type ShopProduct } from "@/lib/types";

/**
 * A fixed bottom bar on the product page, mobile only, that keeps price and
 * "add" in reach while the customer scrolls the description. On desktop the
 * inline AddToBasket in the sidebar already stays visible, so this is hidden
 * there (sm:hidden).
 *
 * Sold-out items show a disabled state — the same rule the rest of the shop
 * follows, driven by the stock ledger.
 */
export function MobileBuyBar({ product }: { product: ShopProduct }) {
  const { add, openDrawer } = useCart();
  const loose = isLoose(product);
  const step = loose ? (product.stepQty > 0 ? product.stepQty : 0.5) : 1;
  const min = loose ? (product.minOrderQty > 0 ? product.minOrderQty : step) : 1;
  const label = packLabel(product);

  const [qty, setQty] = useState(min);

  function bump(dir: 1 | -1) {
    setQty((q) => {
      const next = Math.round((q + dir * step) * 1000) / 1000;
      return Math.min(50, Math.max(min, next));
    });
  }

  function handleAdd() {
    add(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        unit: product.unit,
        price: product.salePrice,
        imagePath: product.imagePath,
        packLabel: label,
        step,
      },
      qty
    );
    openDrawer();
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:hidden">
      {product.inStock ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-line">
            <button
              type="button"
              onClick={() => bump(-1)}
              disabled={qty <= min}
              aria-label="Decrease quantity"
              className="px-3 py-2 text-lg leading-none text-ink-soft disabled:opacity-30"
            >
              −
            </button>
            <span className="min-w-14 text-center text-sm font-medium tabular-nums">
              {formatLineQty(qty, product.unit, label)}
            </span>
            <button
              type="button"
              onClick={() => bump(1)}
              aria-label="Increase quantity"
              className="px-3 py-2 text-lg leading-none text-ink-soft"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-all active:scale-[0.98]"
          >
            Add · {formatRupees(product.salePrice * qty)}
          </button>
        </div>
      ) : (
        <div className="rounded-lg bg-zinc-100 py-2.5 text-center text-sm font-medium text-ink-soft">
          Sold out today
        </div>
      )}
    </div>
  );
}
