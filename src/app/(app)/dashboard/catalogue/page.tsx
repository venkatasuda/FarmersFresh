import Link from "next/link";
import { CatalogueRow } from "./catalogue-row";
import { requireSession } from "@/lib/auth";
import { getAdminCategories, getAdminProducts } from "@/lib/catalogue";

export const metadata = { title: "Catalogue · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ retired?: string }>;
}) {
  const session = await requireSession();
  const { retired } = await searchParams;
  const showRetired = retired === "1";

  const [products, categories] = await Promise.all([
    getAdminProducts(showRetired),
    getAdminCategories(),
  ]);

  const parentName = (id: string | null) => {
    const c = categories.find((x) => x.id === id);
    if (!c) return "Uncategorised";
    const parent = categories.find((p) => p.id === c.parentId);
    return parent ? `${parent.name} → ${c.name}` : c.name;
  };

  const live = products.filter((p) => p.isPublished);
  const noPrice = products.filter((p) => p.salePrice === null && p.isActive);

  if (!session.isOwner) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <h1 className="text-lg font-medium text-ink">Owners only</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
          Changing prices and products is restricted to the account owner.
        </p>
      </div>
    );
  }

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
