import { ProductCard } from "@/features/shop/product-card";
import Link from "next/link";

type SearchPageViewProps = {
  term: string;
  results: import("@/lib/types").ShopProduct[];
  q: string | undefined;
};

export function SearchPageView({ term, results, q }: SearchPageViewProps) {
  return (
    <>
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
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {results.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      )}
    </>
  );
}
