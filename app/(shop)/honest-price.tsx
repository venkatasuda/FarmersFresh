/**
 * The "Honest Price" promise — our answer to the way the big apps quietly pad
 * the bill (handling fee, small-cart fee, surge/"high demand" fee, rain fee,
 * and inflated MRP so a fake "50% off" is really the normal price).
 *
 * Pure presentational component (no hooks, no server imports) so it can drop
 * into either the cart or the checkout summary, both Client Components.
 */

const PROMISES = [
  "No handling or packaging fees",
  "No surge or “high demand” pricing",
  "No fake MRP — only real discounts",
] as const;

export function HonestPrice({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-brand-200 bg-brand-50 p-3 ${className}`}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium text-brand-900">
        <span aria-hidden>🤝</span> Our Honest Price promise
      </p>
      <ul className="mt-2 space-y-1">
        {PROMISES.map((p) => (
          <li
            key={p}
            className="flex items-start gap-1.5 text-xs text-brand-800"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden
              className="mt-0.5 size-3.5 shrink-0 text-brand-600"
            >
              <path
                d="m5 10.5 3 3 7-7.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-brand-700">
        The price you see is the price you pay.
      </p>
    </div>
  );
}
