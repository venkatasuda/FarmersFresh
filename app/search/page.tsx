import Link from "next/link";
import { ProductCard } from "@/app/(shop)/product-card";
import { ShopShell } from "@/app/(shop)/shop-shell";
import { getCatalogue } from "@/lib/shop";

export const metadata = { title: "Search · Farmers Fresh" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = (q ?? "").trim().toLowerCase();

  // Filtering in memory rather than with a database query: the catalogue is
  // six items. A `ilike` round trip per keystroke would be more code and
  // slower. Revisit past a few hundred products, where full-text search and
  // an index start to earn their keep.
  const all = await getCatalogue();
  const results = term
    ? all.filter((p) =>
        [p.name, p.description, p.category]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term)
      )
    : [];

  return (
    <ShopShell>
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        {term ? (
          <>
            {results.length} {results.length === 1 ? "result" : "results"} for
            &ldquo;{q}&rdquo;
          </>
        ) : (
          "Search"
        )}
      </h1>

      {term && results.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
          <p className="text-ink">We don&apos;t have that yet.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
            We cut mutton — leg, shoulder, chops, mince and offal. Chicken and
            fish are coming.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            See everything
          </Link>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {results.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      )}
    </ShopShell>
  );
}
