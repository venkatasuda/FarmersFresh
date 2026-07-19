"use client";

import { useCart } from "./cart-context";

export function CartButton() {
  const { count, ready, openDrawer } = useCart();

  return (
    <button
      type="button"
      onClick={openDrawer}
      className="relative flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition-all hover:bg-brand-700 active:scale-[0.97]"
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-4.5" aria-hidden>
        <path
          d="M3 4h2l2.2 10.5a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.55L20 8H6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="19.5" r="1.4" fill="currentColor" />
        <circle cx="17" cy="19.5" r="1.4" fill="currentColor" />
      </svg>
      <span className="hidden sm:inline">Basket</span>
      {/* Render the count only after hydration — the server can't know what's
          in localStorage, and rendering 0 then 3 is a hydration mismatch. */}
      {ready && count > 0 ? (
        <span className="flex size-5 items-center justify-center rounded-full bg-white text-xs font-semibold text-brand-700">
          {count}
        </span>
      ) : null}
    </button>
  );
}
