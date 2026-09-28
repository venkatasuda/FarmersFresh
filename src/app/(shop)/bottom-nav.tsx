"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./cart-context";

// Inline SVGs — the codebase's icon convention (no icon-lib dependency).
const ICON = "size-5";
function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={ICON} aria-hidden>
      <path d="M4 11.5 12 4l8 7.5M6 10v9h12v-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={ICON} aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={ICON} aria-hidden>
      <path d="M6 8h12l-1 12H7L6 8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 8a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={ICON} aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * App-style bottom tab bar — mobile only. The "this is an app, not a website"
 * signal every q-commerce app leans on. Cart opens the existing drawer rather
 * than navigating, matching Zepto/Blinkit behaviour.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { count, ready, openDrawer } = useCart();

  const tab = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
      active ? "text-brand-700" : "text-ink-soft"
    }`;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch">
        <Link href="/" className={tab(pathname === "/")}>
          <HomeIcon />
          Home
        </Link>
        <Link href="/search" className={tab(pathname.startsWith("/search"))}>
          <SearchIcon />
          Search
        </Link>
        <button type="button" onClick={openDrawer} className={`${tab(false)} relative`}>
          <span className="relative">
            <BagIcon />
            {ready && count > 0 ? (
              <span
                key={count}
                className="ff-badge absolute -top-1.5 -right-2 flex size-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-semibold text-white"
              >
                {count}
              </span>
            ) : null}
          </span>
          Basket
        </button>
        <Link href="/account" className={tab(pathname.startsWith("/account"))}>
          <UserIcon />
          Account
        </Link>
      </div>
    </nav>
  );
}
