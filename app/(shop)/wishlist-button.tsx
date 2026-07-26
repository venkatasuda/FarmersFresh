"use client";

import { useWishlist } from "./wishlist-context";

/**
 * A heart toggle for a product. Filled when favourited. Small variant sits on
 * a product card corner; large on the product page.
 */
export function WishlistButton({
  productId,
  size = "small",
}: {
  productId: string;
  size?: "small" | "large";
}) {
  const { has, toggle, ready } = useWishlist();
  const active = ready && has(productId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(productId);
      }}
      aria-label={active ? "Remove from favourites" : "Add to favourites"}
      aria-pressed={active}
      className={
        size === "small"
          ? "absolute top-2 right-2 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-transform active:scale-90"
          : "flex size-11 items-center justify-center rounded-full border border-line bg-surface transition-transform active:scale-90"
      }
    >
      <svg
        viewBox="0 0 24 24"
        className={size === "small" ? "size-4.5" : "size-6"}
        fill={active ? "#e11d48" : "none"}
        stroke={active ? "#e11d48" : "#5c6b62"}
        strokeWidth="1.8"
      >
        <path
          d="M12 20s-7-4.35-9.2-8.4C1.3 8.9 2.6 5.5 5.8 5.1 7.8 4.85 9.4 6 12 8.6c2.6-2.6 4.2-3.75 6.2-3.5 3.2.4 4.5 3.8 3 6.5C19 15.65 12 20 12 20Z"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
