import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/app/(shop)/product-card";
import { ShopShell } from "@/app/(shop)/shop-shell";
import { getCatalogueByCategory, getCategories } from "@/lib/shop";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const category = (await getCategories()).find((c) => c.slug === slug);
  return {
    title: category
      ? `${category.name} · Farmers Fresh`
      : "Not found · Farmers Fresh",
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;

  const [products, categories] = await Promise.all([
    getCatalogueByCategory(slug),
    getCategories(),
  ]);

  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const parent = category.parentId
    ? categories.find((c) => c.id === category.parentId)
    : null;

  // Sibling subcategories, for jumping sideways within a department.
  const siblings = categories.filter(
    (c) =>
      c.parentId === (category.parentId ?? category.id) &&
      c.productCount > 0 &&
      c.id !== category.id
  );

  // Children, when this IS a department.
  const children = categories.filter(
    (c) => c.parentId === category.id && c.productCount > 0
  );

  return (
    <ShopShell>
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
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink">
          {category.icon ? <span aria-hidden>{category.icon}</span> : null}
          {category.name}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {products.length} {products.length === 1 ? "item" : "items"}
        </p>
      </div>

      {(children.length > 0 ? children : siblings).length > 0 ? (
        <ul className="mb-6 flex flex-wrap gap-2">
          {(children.length > 0 ? children : siblings).map((c) => (
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
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      )}
    </ShopShell>
  );
}
