import Link from "next/link";
import { ProductCard } from "@/app/(shop)/product-card";
import { ShopShell } from "@/app/(shop)/shop-shell";
import { getCatalogue } from "@/lib/shop";

export const metadata = {
  title: "Farmers Fresh — fresh meat, delivered",
};

export default async function ShopHome() {
  const products = await getCatalogue();

  const categories = [...new Set(products.map((p) => p.category ?? "Other"))];

  return (
    <ShopShell>
      {/* Hero. No stock photo behind it — a coloured panel that loads instantly
          beats a 2 MB image of someone else's meat. Replace with your own
          farm photo when you have one. */}
      <section className="mb-8 overflow-hidden rounded-3xl bg-brand-700 px-6 py-10 text-white sm:px-10 sm:py-14">
        <p className="text-sm font-medium text-brand-200">
          From our farms, this morning
        </p>
        <h1 className="mt-2 max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">
          Fresh meat, cut to order, at your door.
        </h1>
        <p className="mt-3 max-w-md text-brand-100">
          We raise it, we cut it, we deliver it. Pay when it reaches you — cash
          or UPI.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Badge>Free delivery over ₹500</Badge>
          <Badge>Pay on delivery</Badge>
          <Badge>Never frozen</Badge>
        </div>
      </section>

      {products.length === 0 ? (
        <EmptyCatalogue />
      ) : (
        <>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-ink">
              Today&apos;s cuts
            </h2>
            <p className="text-sm text-ink-soft">
              {products.length} {products.length === 1 ? "item" : "items"}
              {categories.length > 1 ? ` · ${categories.length} kinds` : null}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        </>
      )}
    </ShopShell>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-brand-600/60 px-3 py-1 font-medium text-white ring-1 ring-brand-400/40 ring-inset">
      {children}
    </span>
  );
}

/**
 * Shown when the catalogue query returns nothing. This is the state you will
 * see first, so it says what to actually do rather than "no products found".
 */
function EmptyCatalogue() {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
      <h2 className="text-lg font-medium text-ink">
        The catalogue is empty
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
        Nothing is published yet. Run migration{" "}
        <code className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-800">
          0003_storefront.sql
        </code>
        , then follow the seed steps in{" "}
        <code className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-800">
          docs/STOREFRONT.md
        </code>{" "}
        to set prices and publish your cuts.
      </p>
      <Link
        href="/login"
        className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        Staff sign in
      </Link>
    </div>
  );
}
