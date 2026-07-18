"use client";

import { useState } from "react";
import { useCart } from "./cart-context";
import type { ShopProduct } from "@/lib/shop";
import { formatQty } from "@/lib/shop";

/**
 * Quantity stepper + add button.
 *
 * Meat is sold by weight, so the control steps in the product's own increment
 * (500 g by default) rather than in whole units. Asking a customer to type
 * "0.75" on a phone keypad is how baskets get abandoned.
 */
export function AddToBasket({
  product,
  size = "default",
}: {
  product: ShopProduct;
  size?: "default" | "compact";
}) {
  const { add } = useCart();
  const [qty, setQty] = useState(product.minOrderQty);
  const [added, setAdded] = useState(false);

  const step = product.stepQty > 0 ? product.stepQty : 0.5;
  const min = product.minOrderQty > 0 ? product.minOrderQty : step;

  // Sold out is decided by the stock ledger, and the database refuses the
  // order anyway — this just avoids letting someone fill a basket they
  // cannot check out.
  if (!product.inStock) {
    return (
      <div
        className={
          size === "compact" ? "flex items-center" : "flex flex-col gap-2"
        }
      >
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-2.5 text-sm font-medium text-ink-soft">
          <span className="size-1.5 rounded-full bg-zinc-400" />
          Sold out today
        </span>
      </div>
    );
  }

  function bump(direction: 1 | -1) {
    setQty((q) => {
      const next = Math.round((q + direction * step) * 1000) / 1000;
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
      },
      qty
    );
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <div
      className={
        size === "compact" ? "flex items-center gap-2" : "flex flex-col gap-3"
      }
    >
      <div className="flex items-center rounded-lg border border-line bg-surface">
        <button
          type="button"
          onClick={() => bump(-1)}
          disabled={qty <= min}
          aria-label="Decrease quantity"
          className="px-3 py-2 text-lg leading-none text-ink-soft transition-colors hover:text-brand-700 disabled:opacity-30"
        >
          −
        </button>
        <span className="min-w-16 text-center text-sm font-medium text-ink tabular-nums">
          {formatQty(qty, product.unit)}
        </span>
        <button
          type="button"
          onClick={() => bump(1)}
          aria-label="Increase quantity"
          className="px-3 py-2 text-lg leading-none text-ink-soft transition-colors hover:text-brand-700"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors ${
          added ? "bg-brand-700" : "bg-brand-600 hover:bg-brand-700"
        } ${size === "compact" ? "" : "w-full"}`}
      >
        {added ? "Added ✓" : "Add to basket"}
      </button>
    </div>
  );
}
