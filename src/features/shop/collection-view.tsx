import { CategoryIcon, categoryTint } from "@/features/shop/category-icon";
import { FilterableGrid } from "@/features/shop/filterable-grid";
import Link from "next/link";

type CollectionPageViewProps = {
  parent: import("@/lib/types").Category | null | undefined;
  category: import("@/lib/types").Category;
  products: import("@/lib/types").ShopProduct[];
  subcategories: import("@/lib/types").Category[];
  siblings: import("@/lib/types").Category[];
};

export function CollectionPageView({ parent, category, products, subcategories, siblings }: CollectionPageViewProps) {
  return (
    <>
      <nav className="mb-4 text-sm text-ink-soft">
        <Link href="/" className="hover:text-brand-700">
          Shop
        </Link>
        <span className="mx-2">/</span>
        {parent ? (
          <>
            <Link
              href={`/collections/${parent.slug}`}
              className="hover:text-brand-700"
            >
              {parent.name}
            </Link>
            <span className="mx-2">/</span>
          </>
        ) : null}
        <span className="text-ink">{category.name}</span>
      </nav>

      <div className="mb-5">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-ink">
          <span
            className="flex size-10 items-center justify-center rounded-xl"
            style={{
              // A subcategory borrows its parent department's tint for a
              // consistent colour down the whole tree.
              background: categoryTint(parent?.slug ?? category.slug).bg,
              color: categoryTint(parent?.slug ?? category.slug).fg,
            }}
          >
            <CategoryIcon slug={parent?.slug ?? category.slug} className="size-6" />
          </span>
          {category.name}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {products.length} {products.length === 1 ? "item" : "items"}
        </p>
      </div>

      {(subcategories.length > 0 ? subcategories : siblings).length > 0 ? (
        <ul className="mb-6 flex flex-wrap gap-2">
          {(subcategories.length > 0 ? subcategories : siblings).map((c) => (
            <li key={c.id}>
              <Link
                href={`/collections/${c.slug}`}
                className="inline-block rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
              >
                {c.name}
                <span className="ml-1.5 text-xs text-ink-soft/70">
                  {c.productCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {products.length === 0 ? (
        // Not a 404 — the category legitimately exists, it's just empty today.
        // Telling a customer "nothing here yet" beats a dead end.
        <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
          <p className="text-ink">Nothing in {category.name} today.</p>
          <p className="mt-2 text-sm text-ink-soft">
            We&apos;re restocking. Try again tomorrow.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            See everything
          </Link>
        </div>
      ) : (
        <FilterableGrid products={products} />
      )}
    </>
  );
}
