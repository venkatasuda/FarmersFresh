import Link from "next/link";
import { AddToBasket } from "@/app/(shop)/add-to-basket";
import { ProductCard } from "@/app/(shop)/product-card";
import { ProductImage } from "@/app/(shop)/product-image";
import { ShopShell } from "@/app/(shop)/shop-shell";
import { getOffers, getPersonalOffers } from "@/lib/shop";
import { formatRupees } from "@/lib/format";
import { discountPercent } from "@/lib/types";

export const metadata = {
  title: "This week's deals · Farmers Fresh",
  description: "Fresh markdowns across the store — biggest savings first.",
};
export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const [offers, personal] = await Promise.all([
    getOffers(),
    getPersonalOffers(),
  ]);

  const featured = offers[0] ?? null;
  const rest = featured ? offers.slice(1) : offers;

  return (
    <ShopShell>
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            This week&apos;s deals
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Fresh markdowns across the store — biggest savings first.
          </p>
        </header>

        {offers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
            <h2 className="text-lg font-medium text-ink">No deals right now</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
              We refresh our offers often — check back soon, or browse the full
              shop.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Browse the shop
            </Link>
          </div>
        ) : (
          <>
            {/* Deal of the week — the single biggest markdown, given room. */}
            {featured ? (
              <section className="overflow-hidden rounded-2xl border border-brand-200 bg-brand-50">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Link
                    href={`/shop/${featured.slug}`}
                    className="relative aspect-square sm:aspect-auto"
                  >
                    <ProductImage
                      src={featured.imagePath}
                      alt={featured.name}
                      priority
                    />
                    <span className="absolute top-3 left-3 rounded-md bg-red-600 px-2.5 py-1 text-sm font-semibold text-white">
                      {discountPercent(featured)}% off
                    </span>
                  </Link>
                  <div className="flex flex-col justify-center gap-3 p-5 sm:p-6">
                    <span className="text-xs font-medium tracking-wide text-brand-700 uppercase">
                      Deal of the week
                    </span>
                    {featured.brand ? (
                      <p className="text-xs tracking-wide text-ink-soft uppercase">
                        {featured.brand}
                      </p>
                    ) : null}
                    <h2 className="text-xl font-semibold tracking-tight text-ink">
                      <Link
                        href={`/shop/${featured.slug}`}
                        className="hover:text-brand-700"
                      >
                        {featured.name}
                      </Link>
                    </h2>
                    <div className="flex items-baseline gap-3">
                      <span className="text-2xl font-semibold text-ink">
                        {formatRupees(featured.salePrice)}
                      </span>
                      {featured.compareAtPrice ? (
                        <span className="text-base text-ink-soft line-through">
                          {formatRupees(featured.compareAtPrice)}
                        </span>
                      ) : null}
                    </div>
                    <div className="max-w-xs">
                      <AddToBasket product={featured} />
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {/* Picked for you — deals on things they've bought before. */}
            {personal.length > 0 ? (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
                  <span className="h-5 w-1 rounded-full bg-brand-500" />
                  Deals picked for you
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                  {personal.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Everything on offer. */}
            {rest.length > 0 ? (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
                  <span className="h-5 w-1 rounded-full bg-brand-500" />
                  All deals
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                  {rest.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </ShopShell>
  );
}
