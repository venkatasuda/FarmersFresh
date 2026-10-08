import { ProductCard } from "@/features/shop/product-card";
import Link from "next/link";

type SearchPageViewProps = {
  term: string;
  results: import("@/lib/types").ShopProduct[];
  q: string | undefined;
  page?: string;
};

export function SearchPageView({ term, results, q, page }: SearchPageViewProps) {
  const pages = Math.max(1, Math.ceil(results.length / 24));
  const requested = page && /^\d+$/.test(page) ? Number(page) : 1;
  const current = Number.isSafeInteger(requested) ? Math.min(pages, Math.max(1, requested)) : 1;
  const visible = results.slice((current - 1) * 24, current * 24);
  const pageUrl = (number: number) => `/search?${new URLSearchParams({ q: term, page: String(number) })}`;
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
          {visible.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      )}
      {pages > 1 ? <nav aria-label="Search result pages" className="mt-6 flex items-center justify-between gap-4 text-sm text-ink">
        {current > 1 ? <Link href={pageUrl(current - 1)} prefetch={false} className="rounded-lg border border-line bg-surface px-4 py-2">Previous page</Link> : <span />}
        <span>Page {current} of {pages}</span>
        {current < pages ? <Link href={pageUrl(current + 1)} prefetch={false} className="rounded-lg bg-brand-600 px-4 py-2 text-white">Next page</Link> : <span />}
      </nav> : null}
    </>
  );
}
