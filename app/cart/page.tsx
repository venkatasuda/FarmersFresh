"use client";

import Link from "next/link";
import { useCart } from "@/app/(shop)/cart-context";
import { ProductImage } from "@/app/(shop)/product-image";
import { ShopShell } from "@/app/(shop)/shop-shell";
import { formatQty, formatRupees } from "@/lib/shop";

const FREE_DELIVERY_OVER = 500;
const DELIVERY_FEE = 40;

export default function CartPage() {
  const { lines, setQuantity, remove, subtotal, ready } = useCart();

  // These figures are indicative only — place_order recalculates both the
  // prices and the fee server-side, so a tampered page cannot change a total.
  const fee = subtotal >= FREE_DELIVERY_OVER || subtotal === 0 ? 0 : DELIVERY_FEE;
  const total = subtotal + fee;

  if (!ready) {
    return (
      <ShopShell>
        <p className="py-20 text-center text-sm text-ink-soft">
          Loading your basket…
        </p>
      </ShopShell>
    );
  }

  if (lines.length === 0) {
    return (
      <ShopShell>
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
      </ShopShell>
    );
  }

  return (
    <ShopShell>
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
                      {formatRupees(line.price)} / {line.unit}
                    </p>
                  </div>
                  <p className="font-semibold text-ink tabular-nums">
                    {formatRupees(line.price * line.quantity)}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center rounded-lg border border-line">
                    <button
                      type="button"
                      onClick={() => setQuantity(line.productId, line.quantity - 0.5)}
                      aria-label={`Less ${line.name}`}
                      className="px-2.5 py-1.5 text-ink-soft hover:text-brand-700"
                    >
                      −
                    </button>
                    <span className="min-w-14 text-center text-sm font-medium tabular-nums">
                      {formatQty(line.quantity, line.unit)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(line.productId, line.quantity + 0.5)}
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

        <aside className="h-fit rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-20">
          <h2 className="text-sm font-medium text-ink">Summary</h2>

          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Subtotal" value={formatRupees(subtotal)} />
            <Row
              label="Delivery"
              value={fee === 0 ? "Free" : formatRupees(fee)}
              accent={fee === 0}
            />
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
    </ShopShell>
  );
}

function Row({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd
        className={
          accent ? "font-medium text-brand-700" : "text-ink tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}
