import { CatalogueRow } from "@/features/dashboard/catalogue/catalogue-row";
import Link from "next/link";

type CataloguePageViewProps = {
  live: import("@/lib/types").AdminProduct[];
  products: import("@/lib/types").AdminProduct[];
  showRetired: boolean;
  noPrice: import("@/lib/types").AdminProduct[];
  parentName: (id: string | null) => string;
};

export function CataloguePageView({ live, products, showRetired, noPrice, parentName }: CataloguePageViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Catalogue
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {live.length} on the shop · {products.length} total
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href={
              showRetired ? "/dashboard/catalogue" : "/dashboard/catalogue?retired=1"
            }
            className="rounded-lg border border-line px-3 py-2 text-sm text-ink-soft hover:text-ink"
          >
            {showRetired ? "Hide retired" : "Show retired"}
          </Link>
          <Link
            href="/dashboard/catalogue/new"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Add product
          </Link>
        </div>
      </div>

      {noPrice.length > 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {noPrice.length}{" "}
          {noPrice.length === 1 ? "product has" : "products have"} no price and
          cannot go on the shop until one is set.
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <ul className="divide-y divide-line">
          {products.map((p) => (
            <CatalogueRow
              key={p.id}
              product={p}
              categoryName={parentName(p.categoryId)}
            />
          ))}
        </ul>

        {products.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-ink-soft">
            Nothing here yet.
          </p>
        ) : null}
      </section>

      <p className="text-xs text-ink-soft">
        A product appears on the shop only when it is ticked{" "}
        <em>On shop</em>, has a price, and has stock on hand. All three, every
        time — that&apos;s what stops you selling something you don&apos;t have.
      </p>

    </div>
  );
}
