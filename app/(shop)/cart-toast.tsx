"use client";

import { useEffect, useState } from "react";
import { useCart } from "./cart-context";

/**
 * The "added to basket" confirmation every good grocery app shows — a small
 * card that slides up, confirms what went in, offers a jump to the basket,
 * and gets out of the way on its own.
 *
 * Mounted once at the app root. It listens to the cart's `notice` and animates
 * itself; nothing else has to know it exists.
 */
export function CartToast() {
  const { notice, dismissNotice, openDrawer } = useCart();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!notice) return;
    setVisible(true);
    const hide = window.setTimeout(() => setVisible(false), 2600);
    // Clear the notice from context a beat after it slides out, so the exit
    // animation can finish.
    const clear = window.setTimeout(() => dismissNotice(), 2900);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(clear);
    };
  }, [notice, dismissNotice]);

  if (!notice) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[calc(100%-2rem)] max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-lg transition-all duration-300 ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
        <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
          <path
            d="m5 13 4 4L19 7"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <p className="flex-1 truncate text-sm text-ink">
        <span className="font-medium">{notice.name}</span> added
      </p>

      <button
        type="button"
        onClick={() => {
          dismissNotice();
          openDrawer();
        }}
        className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        View
      </button>
    </div>
  );
}
