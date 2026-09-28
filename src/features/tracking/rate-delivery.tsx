"use client";

import { useState, useTransition } from "react";
import { rateDelivery } from "./actions";

/**
 * Post-delivery feedback: 1–5 stars and an optional note. Shown on the track
 * page once an order is delivered. One rating per order (the server enforces
 * it); after submitting we show a thank-you.
 */
export function RateDelivery({
  orderNumber,
  phone,
}: {
  orderNumber: string;
  phone: string;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        {done}
      </div>
    );
  }

  function submit() {
    if (rating < 1) {
      setError("Tap a star to rate.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await rateDelivery(orderNumber, phone, rating, comment);
      if (r.ok) setDone(r.message);
      else setError(r.message);
    });
  }

  return (
    <div className="mt-5 rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-medium text-ink">How was your delivery?</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className="p-0.5"
          >
            <svg
              viewBox="0 0 24 24"
              className={`size-8 ${
                (hover || rating) >= n ? "text-amber-400" : "text-line"
              }`}
              fill="currentColor"
            >
              <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 21.4l1.4-6.8L2.2 9.9l6.9-.8L12 2z" />
            </svg>
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Anything to add? (optional)"
        className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500"
      />
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Submit rating"}
      </button>
    </div>
  );
}
