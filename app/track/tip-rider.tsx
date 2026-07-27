"use client";

import { useState, useTransition } from "react";
import { tipDelivery } from "./actions";

/**
 * Tip the rider from loyalty points after delivery — payment-free thanks. The
 * shop settles the tip with the rider; the customer's points cover it. Needs a
 * signed-in customer (points); the server tells guests to sign in.
 */
export function TipRider({ orderNumber }: { orderNumber: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function tip(points: number) {
    setError(null);
    startTransition(async () => {
      const r = await tipDelivery(orderNumber, points);
      if (r.ok) setDone(points);
      else setError(r.message ?? "Couldn't tip just now.");
    });
  }

  if (done) {
    return (
      <p className="mt-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        Thank you! You tipped {done} points to your rider. 🙏
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-medium text-ink">Tip your rider</p>
      <p className="text-xs text-ink-soft">A thank-you, paid from your loyalty points.</p>
      <div className="mt-2 flex gap-2">
        {[10, 20, 50].map((p) => (
          <button
            key={p}
            type="button"
            disabled={pending}
            onClick={() => tip(p)}
            className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60"
          >
            {p} pts
          </button>
        ))}
      </div>
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
