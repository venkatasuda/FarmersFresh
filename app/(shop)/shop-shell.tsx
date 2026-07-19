import Link from "next/link";
import { Suspense } from "react";
import { Leaf } from "@/app/brand";
import { AnnouncementBar } from "./announcement-bar";
import { CartButton } from "./cart-button";
import { SearchBox } from "./search-box";
import { getCategories } from "@/lib/shop";
import { buildCategoryTree } from "@/lib/types";

/**
 * Public chrome for the customer-facing shop.
 *
 * A component rather than a `layout.tsx` because the catalogue lives at `/`,
 * which the root segment already owns — wrapping explicitly avoids a route
 * conflict and keeps the staff area free of shop chrome.
 *
 * Layout follows the standard grocery-storefront skeleton: promise strip,
 * logo + search + basket, category rail. That shape is near-universal
 * (Jamoona, BigBasket, Licious all use it) because it survives a catalogue
 * growing from six items to six hundred without a redesign.
 */
export async function ShopShell({ children }: { children: React.ReactNode }) {
  const categories = await getCategories();
  const tree = buildCategoryTree(categories);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas">
      <AnnouncementBar />

      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2"
            aria-label="Farmers Fresh — home"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Leaf className="size-5" />
            </span>
            <span className="hidden text-lg font-semibold tracking-tight text-ink sm:inline">
              Farmers<span className="text-brand-600">Fresh</span>
            </span>
          </Link>

          {/* useSearchParams needs a Suspense boundary or the whole route
              opts out of static rendering. */}
          <Suspense fallback={<div className="h-10 flex-1" />}>
            <SearchBox className="flex-1" />
          </Suspense>

          <CartButton />
        </div>

        {tree.length > 0 ? (
          <nav
            aria-label="Departments"
            className="mx-auto max-w-6xl overflow-x-auto px-4 pb-2"
          >
            <ul className="flex gap-1 whitespace-nowrap">
              <li>
                <Link
                  href="/"
                  className="inline-block rounded-full px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-800"
                >
                  All
                </Link>
              </li>
              {tree.map(({ department, children }) => (
                // CSS-only dropdown via group-hover. No JS, so it works
                // before hydration and costs nothing on a slow phone.
                <li key={department.id} className="group relative">
                  <Link
                    href={`/collections/${department.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-ink-soft transition-colors group-hover:bg-brand-50 group-hover:text-brand-800"
                  >
                    {department.icon ? (
                      <span aria-hidden>{department.icon}</span>
                    ) : null}
                    {department.name}
                  </Link>

                  {children.length > 0 ? (
                    <div className="invisible absolute top-full left-0 z-30 pt-1 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100">
                      <ul className="min-w-52 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
                        {children.map((child) => (
                          <li key={child.id}>
                            <Link
                              href={`/collections/${child.slug}`}
                              className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-brand-50 hover:text-brand-800"
                            >
                              {child.name}
                              <span className="text-xs text-ink-soft">
                                {child.productCount}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>

      <footer className="mt-8 border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <span className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Leaf className="size-4" />
              </span>
              <span className="font-semibold tracking-tight text-ink">
                Farmers<span className="text-brand-600">Fresh</span>
              </span>
            </span>
            <p className="mt-3 text-sm text-ink-soft">
              We raise it, we cut it, we deliver it. Meat from our own farms in
              Telangana.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-ink">Shop</h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              <li>
                <Link href="/" className="hover:text-brand-700">
                  All cuts
                </Link>
              </li>
              {categories.slice(0, 4).map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/collections/${c.slug}`}
                    className="hover:text-brand-700"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium text-ink">Help</h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              <li>
                <Link href="/delivery-info" className="hover:text-brand-700">
                  Delivery
                </Link>
              </li>
              <li>
                <Link href="/returns" className="hover:text-brand-700">
                  Returns & refunds
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-brand-700">
                  Contact us
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-brand-700">
                  About
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-ink-soft">
            <p>© {new Date().getFullYear()} Farmers Fresh</p>
            <nav className="flex gap-4">
              <Link href="/privacy" className="hover:text-brand-700">
                Privacy
              </Link>
              <Link href="/returns" className="hover:text-brand-700">
                Refunds
              </Link>
              <Link href="/login" className="hover:text-brand-700">
                Staff sign in
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
