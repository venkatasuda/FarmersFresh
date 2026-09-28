"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createSubscription } from "./subscribe-actions";
import { formatRupees } from "@/lib/format";
import type { ShopProduct } from "@/lib/types";

/**
 * "Subscribe & save" on the product page — the grocery retention feature.
 * Collapsed behind a toggle so it doesn't crowd the buy button. Needs a
 * logged-in customer with a delivery address; otherwise it points them there.
 */
export function SubscribeBox({
  product,
  discountPct = 0,
}: {
  product: ShopProduct;
  discountPct?: number;
}) {
  const loose = product.packSize === null;
  const step = loose ? (product.stepQty > 0 ? product.stepQty : 0.5) : 1;
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(loose ? (product.minOrderQty > 0 ? product.minOrderQty : step) : 1);
  const [freq, setFreq] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // The standing subscriber saving, applied to each recurring delivery. The
  // server (run_one_subscription) is the source of truth; this only previews it.
  const saves = discountPct > 0;
  const lineTotal = product.salePrice * qty;
  const saved = saves ? Math.round((lineTotal * discountPct) / 100 * 100) / 100 : 0;
  const eachTotal = Math.round((lineTotal - saved) * 100) / 100;

  function subscribe() {
    setError(null);
    startTransition(async () => {
      const r = await createSubscription(product.id, qty, freq);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        Subscription set up. Manage it any time in{" "}
        <Link href="/account" className="font-medium underline">
          your account
        </Link>
        .
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand-300 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
          <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.7 5.7L4 16M4 20v-4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {saves ? `Subscribe & save ${discountPct}%` : "Subscribe & save"}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm font-medium text-ink">Repeat delivery</p>
      {saves ? (
        <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
          Save {discountPct}% on every delivery
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs text-ink-soft">Every</span>
          <select
            value={freq}
            onChange={(e) => setFreq(e.target.value as typeof freq)}
            className="mt-1 block rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="daily">Day</option>
            <option value="weekly">Week</option>
            <option value="monthly">Month</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-ink-soft">Quantity</span>
          <input
            type="number"
            min="0"
            step={loose ? "0.5" : "1"}
            value={qty}
            onChange={(e) => setQty(Math.max(step, Number.parseFloat(e.target.value) || step))}
            className="mt-1 w-24 rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums"
          />
        </label>
      </div>

      {saves ? (
        <div className="mt-3 flex items-baseline justify-between rounded-lg bg-brand-50 px-3 py-2 text-sm">
          <span className="text-brand-800">Each delivery</span>
          <span className="text-brand-900">
            <span className="text-ink-soft line-through">
              {formatRupees(lineTotal)}
            </span>{" "}
            <span className="font-semibold tabular-nums">
              {formatRupees(eachTotal)}
            </span>
            <span className="ml-1 text-xs font-medium">
              (save {formatRupees(saved)})
            </span>
          </span>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={subscribe}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Setting up…" : "Start subscription"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft">
          Cancel
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        First delivery tomorrow, then every {freq === "daily" ? "day" : freq === "weekly" ? "week" : "month"}.
        {saves ? ` You save ${discountPct}% on every one.` : ""} Cancel any time.
      </p>
    </div>
  );
}
