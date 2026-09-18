import Link from "next/link";
import { ProductCard } from "@/app/(shop)/product-card";
import { ShopShell } from "@/app/(shop)/shop-shell";
import { getCatalogue } from "@/lib/shop";
import { searchItems } from "@/lib/search";

export const metadata = { title: "Search · Farmers Fresh" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();

  // Typo- and language-tolerant, ranked. In-memory over the catalogue (small);
  // see lib/search.ts for the scale note.
  const all = await getCatalogue();
  const results = searchItems(all, term);

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
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {results.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      )}
    </ShopShell>
  );
}
