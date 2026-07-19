"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "./cart-context";
import { ProductImage } from "./product-image";
import { formatLineQty, formatRupees } from "@/lib/format";
import { FREE_DELIVERY_OVER, deliveryFeeFor } from "@/lib/types";

/**
 * The slide-out basket. Clicking the header cart opens this instead of a full
 * page navigation — the interaction every serious grocery site uses, because
 * it lets a customer keep shopping without losing their place.
 *
 * The full `/cart` page still exists for direct links and no-JS fallback.
 */
export function CartDrawer() {
  const {
    lines,
    setQuantity,
    remove,
    subtotal,
    drawerOpen,
    closeDrawer,
    ready,
  } = useCart();

  // Close on Escape, and lock body scroll while open — the small correctnesses
  // that separate a real drawer from a div that slides.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeDrawer();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen, closeDrawer]);

  const fee = deliveryFeeFor(subtotal);
  const toFree = FREE_DELIVERY_OVER - subtotal;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeDrawer}
        aria-hidden
        className={`fixed inset-0 z-40 bg-ink/40 transition-opacity duration-300 ${
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Your basket"
        className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col bg-canvas shadow-2xl transition-transform duration-300 ease-out ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3.5">
          <h2 className="text-base font-semibold text-ink">
            Your basket
            {ready && lines.length > 0 ? (
              <span className="ml-2 text-sm font-normal text-ink-soft">
                ({lines.length})
              </span>
            ) : null}
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close basket"
            className="rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {!ready || lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-300">
              <svg viewBox="0 0 24 24" fill="none" className="size-7" aria-hidden>
                <path
                  d="M3 4h2l2.2 10.5a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.55L20 8H6"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <p className="text-ink">Your basket is empty</p>
            <button
              type="button"
              onClick={closeDrawer}
              className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Start shopping
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {lines.map((line) => (
                <div
                  key={line.productId}
                  className="flex gap-3 rounded-xl border border-line bg-surface p-2.5"
                >
                  <Link
                    href={`/shop/${line.slug}`}
                    onClick={closeDrawer}
                    className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-brand-50"
                  >
                    <ProductImage src={line.imagePath} alt={line.name} />
                  </Link>

                  <div className="flex flex-1 flex-col justify-between gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/shop/${line.slug}`}
                        onClick={closeDrawer}
                        className="text-sm font-medium text-ink hover:text-brand-700"
                      >
                        {line.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove(line.productId)}
                        aria-label={`Remove ${line.name}`}
                        className="text-ink-soft transition-colors hover:text-red-600"
                      >
                        <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
                          <path
                            d="M6 6l12 12M18 6L6 18"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center rounded-lg border border-line">
                        <button
                          type="button"
                          onClick={() =>
                            setQuantity(line.productId, line.quantity - (line.step || 0.5))
                          }
                          aria-label="Less"
                          className="px-2 py-1 text-ink-soft hover:text-brand-700"
                        >
                          −
                        </button>
                        <span className="min-w-16 text-center text-xs font-medium tabular-nums">
                          {formatLineQty(line.quantity, line.unit, line.packLabel)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setQuantity(line.productId, line.quantity + (line.step || 0.5))
                          }
                          aria-label="More"
                          className="px-2 py-1 text-ink-soft hover:text-brand-700"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-medium text-ink tabular-nums">
                        {formatRupees(line.price * line.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <footer className="border-t border-line bg-surface p-4">
              {/* Progress toward free delivery — a gentle nudge to add one
                  more item, and a small reward when they cross the line. */}
              <div className="mb-3">
                <p className="mb-1.5 text-xs text-brand-800">
                  {toFree > 0
                    ? `Add ${formatRupees(toFree)} more for free delivery`
                    : "✓ You've unlocked free delivery"}
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-brand-100">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (subtotal / FREE_DELIVERY_OVER) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-sm text-ink-soft">Subtotal</span>
                <span className="text-lg font-semibold text-ink tabular-nums">
                  {formatRupees(subtotal)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-soft">
                {fee === 0 ? "Free delivery" : `+ ${formatRupees(fee)} delivery`} ·
                pay on delivery
              </p>

              <Link
                href="/checkout"
                onClick={closeDrawer}
                className="mt-3 block rounded-lg bg-brand-600 px-4 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-brand-700"
              >
                Checkout · {formatRupees(subtotal + fee)}
              </Link>
              <button
                type="button"
                onClick={closeDrawer}
                className="mt-2 w-full text-center text-sm text-ink-soft hover:text-ink"
              >
                Keep shopping
              </button>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
