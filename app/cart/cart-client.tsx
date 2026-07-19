"use client";

import Link from "next/link";
import { useCart } from "@/app/(shop)/cart-context";
import { ProductImage } from "@/app/(shop)/product-image";
import { formatLineQty, formatRupees } from "@/lib/format";
import { FREE_DELIVERY_OVER, deliveryFeeFor } from "@/lib/types";

/**
 * The basket body. Split out from `page.tsx` because `ShopShell` is an async
 * Server Component (it loads categories) and a Client Component cannot render
 * one. The page stays a server component; only this part ships to the browser.
 */
export function CartClient() {
  const { lines, setQuantity, remove, subtotal, ready } = useCart();

  // Indicative only — place_order recalculates prices and fee server-side,
  // so a tampered page can change what is SHOWN, never what is CHARGED.
  const fee = deliveryFeeFor(subtotal);
  const total = subtotal + fee;

  if (!ready) {
    return (
      <p className="py-20 text-center text-sm text-ink-soft">
        Loading your basket…
      </p>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
        <h1 className="text-lg font-medium text-ink">Your basket is empty</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Everything is cut fresh the morning it goes out.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Browse today&apos;s cuts
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight text-ink">
        Your basket
      </h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <ul className="space-y-3 lg:col-span-2">
          {lines.map((line) => (
            <li
              key={line.productId}
              className="flex gap-4 rounded-2xl border border-line bg-surface p-3"
            >
              <Link
                href={`/shop/${line.slug}`}
                className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-brand-50"
              >
                <ProductImage src={line.imagePath} alt={line.name} />
              </Link>

              <div className="flex flex-1 flex-col justify-between gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/shop/${line.slug}`}
                      className="font-medium text-ink hover:text-brand-700"
                    >
                      {line.name}
                    </Link>
                    <p className="text-sm text-ink-soft">
                      {formatRupees(line.price)}
                      {line.packLabel ? ` per ${line.packLabel}` : ` / ${line.unit}`}
                    </p>
                  </div>
                  <p className="font-semibold text-ink tabular-nums">
                    {formatRupees(line.price * line.quantity)}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center rounded-lg border border-line">
                    {/* Step by the line's own increment — 500 g for a cut,
                        one whole pack for a packet. */}
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(line.productId, line.quantity - (line.step || 0.5))
                      }
                      aria-label={`Less ${line.name}`}
                      className="px-2.5 py-1.5 text-ink-soft hover:text-brand-700"
                    >
                      −
                    </button>
                    <span className="min-w-20 text-center text-sm font-medium tabular-nums">
                      {formatLineQty(line.quantity, line.unit, line.packLabel)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(line.productId, line.quantity + (line.step || 0.5))
                      }
                      aria-label={`More ${line.name}`}
                      className="px-2.5 py-1.5 text-ink-soft hover:text-brand-700"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(line.productId)}
                    className="text-sm text-ink-soft hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-36">
          <h2 className="text-sm font-medium text-ink">Summary</h2>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd className="text-ink tabular-nums">{formatRupees(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Delivery</dt>
              <dd
                className={
                  fee === 0 ? "font-medium text-brand-700" : "text-ink tabular-nums"
                }
              >
                {fee === 0 ? "Free" : formatRupees(fee)}
              </dd>
            </div>
          </dl>

          {subtotal < FREE_DELIVERY_OVER ? (
            <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
              Add {formatRupees(FREE_DELIVERY_OVER - subtotal)} more for free
              delivery.
            </p>
          ) : null}

          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="font-medium text-ink">Total</span>
            <span className="text-xl font-semibold text-ink tabular-nums">
              {formatRupees(total)}
            </span>
          </div>

          <Link
            href="/checkout"
            className="mt-5 block rounded-lg bg-brand-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-brand-700"
          >
            Continue to delivery
          </Link>

          <p className="mt-3 text-center text-xs text-ink-soft">
            Pay cash or UPI when it arrives. Weights are confirmed at cutting.
          </p>
        </aside>
      </div>
    </>
  );
}
