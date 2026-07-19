"use client";

import { useEffect, useState } from "react";

/**
 * The rotating promise strip every grocery storefront runs along the top.
 *
 * Each line must be a promise you can actually keep. "150,000 happy customers"
 * works for an established shop; claiming it on day one is a lie a customer
 * can smell. These are all things Farmers Fresh genuinely does — replace the
 * delivery threshold here if you change it in `place_order`.
 */
const MESSAGES = [
  "🚚 Free delivery on orders over ₹500",
  "🔪 Cut fresh the morning it goes out — never frozen",
  "💵 Pay cash or UPI on delivery",
  "🐐 Raised on our own farms",
];

export function AnnouncementBar() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = window.setInterval(
      () => setI((v) => (v + 1) % MESSAGES.length),
      4000
    );
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="bg-brand-800 text-white">
      <div className="mx-auto flex h-9 max-w-6xl items-center justify-center px-4">
        {/* Only the active line is visible, but all of them stay in the DOM so
            a screen reader and a crawler see the full set, not a flicker. */}
        <p key={i} className="animate-in fade-in text-center text-xs font-medium sm:text-sm">
          {MESSAGES[i]}
        </p>
        <span className="sr-only">
          {MESSAGES.filter((_, idx) => idx !== i).join(". ")}
        </span>
      </div>
    </div>
  );
}
