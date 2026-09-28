"use client";

import Link from "next/link";
import { useWishlist } from "./wishlist-context";

export function WishlistHeaderButton() {
  const { count, ready } = useWishlist();

  return (
    <Link
      href="/wishlist"
      aria-label="Favourites"
      className="relative flex shrink-0 items-center justify-center rounded-lg p-2 text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 20s-7-4.35-9.2-8.4C1.3 8.9 2.6 5.5 5.8 5.1 7.8 4.85 9.4 6 12 8.6c2.6-2.6 4.2-3.75 6.2-3.5 3.2.4 4.5 3.8 3 6.5C19 15.65 12 20 12 20Z" strokeLinejoin="round" />
      </svg>
      {ready && count > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-semibold text-white">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
