import Link from "next/link";
import { Leaf } from "@/app/brand";
import { CartButton } from "./cart-button";

/**
 * Public chrome for the customer-facing shop.
 *
 * A component rather than a `layout.tsx` because the catalogue lives at `/`,
 * which is already owned by the root segment — wrapping explicitly avoids a
 * route conflict and keeps the staff area free of shop chrome.
 */
export function ShopShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="Farmers Fresh — home"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Leaf className="size-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-ink">
              Farmers<span className="text-brand-600">Fresh</span>
            </span>
          </Link>

          <CartButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Farmers Fresh · Meat from our own farms
          </p>
          <Link href="/login" className="hover:text-brand-700">
            Staff sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
