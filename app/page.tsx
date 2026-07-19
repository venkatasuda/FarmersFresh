import Link from "next/link";
import { ProductCard } from "@/app/(shop)/product-card";
import { ShopShell } from "@/app/(shop)/shop-shell";
import { getCatalogue, getCategories } from "@/lib/shop";
import { buildCategoryTree } from "@/lib/types";

export const metadata = {
  title: "Farmers Fresh — Indian groceries & fresh meat, delivered",
};

export default async function ShopHome() {
  const [products, categories] = await Promise.all([
    getCatalogue(),
    getCategories(),
  ]);

  const tree = buildCategoryTree(categories);
  const byCategory = new Map(categories.map((c) => [c.slug, c]));

  // Merchandising rows. With 35 products across 13 departments, one flat grid
  // is a wall — a customer needs a reason to click something.
  const deals = products.filter((p) => p.compareAtPrice !== null);
  const meat = products.filter((p) => p.categorySlug === "mutton");

  return (
    <ShopShell>
      <section className="mb-8 overflow-hidden rounded-3xl bg-brand-700 px-6 py-10 text-white sm:px-10 sm:py-14">
        <p className="text-sm font-medium text-brand-200">
          Groceries & fresh meat, one delivery
        </p>
        <h1 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Your rice, dal and today&apos;s cut — at your door.
        </h1>
        <p className="mt-3 max-w-md text-brand-100">
          Everyday Indian groceries, plus meat from our own farms. Pay when it
          reaches you.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Badge>Free delivery over ₹500</Badge>
          <Badge>Pay on delivery</Badge>
          <Badge>Meat cut to order</Badge>
        </div>
      </section>

      {products.length === 0 ? (
        <EmptyCatalogue />
      ) : (
        <>
          {/* Department tiles — the standard grocery entry point. */}
          {tree.length > 0 ? (
            <section className="mb-10">
              <h2 className="mb-3 text-lg font-semibold tracking-tight text-ink">
                Shop by department
              </h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {tree.map(({ department }) => (
                  <Link
                    key={department.id}
                    href={`/collections/${department.slug}`}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-center transition-colors hover:border-brand-300 hover:bg-brand-50"
                  >
                    <span className="text-2xl" aria-hidden>
                      {department.icon ?? "🛒"}
                    </span>
                    <span className="text-xs leading-tight font-medium text-ink">
                      {department.name}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {meat.length > 0 ? (
            <Row
              title="Today's cuts"
              subtitle="From our own farms, cut this morning"
              href="/collections/meat-eggs"
              products={meat}
              priority
            />
          ) : null}

          {deals.length > 0 ? (
            <Row
              title="Value deals"
              subtitle="Reduced this week"
              products={deals}
            />
          ) : null}

          {/* Everything else, grouped by department so the page reads as a
              shop rather than an undifferentiated grid. */}
          {tree.map(({ department }) => {
            const inDept = products.filter((p) => {
              const cat = p.categorySlug ? byCategory.get(p.categorySlug) : null;
              return cat?.parentId === department.id;
            });
            if (inDept.length === 0 || department.slug === "meat-eggs") return null;
            return (
              <Row
                key={department.id}
                title={department.name}
                href={`/collections/${department.slug}`}
                products={inDept.slice(0, 4)}
              />
            );
          })}

          <section className="mt-10 grid gap-4 rounded-2xl border border-line bg-surface p-6 sm:grid-cols-3">
            <TrustPoint
              title="Meat from our own farms"
              body="We raise the animals we sell. No middleman, no mystery supplier."
            />
            <TrustPoint
              title="Cut, not thawed"
              body="Meat is cut the morning it goes out. Nothing frozen is sold as fresh."
            />
            <TrustPoint
              title="You pay for what you get"
              body="Cuts are weighed at packing. The final price follows the scale."
            />
          </section>
        </>
      )}
    </ShopShell>
  );
}

function Row({
  title,
  subtitle,
  href,
  products,
  priority = false,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  products: Awaited<ReturnType<typeof getCatalogue>>;
  priority?: boolean;
}) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-sm text-ink-soft">{subtitle}</p>
          ) : null}
        </div>
        {/* Only show "See all" when the row maps to a real category page.
            The curated deals row spans categories, so it has no single target. */}
        {href ? (
          <Link
            href={href}
            className="group shrink-0 text-sm font-medium text-brand-700"
          >
            See all{" "}
            <span className="inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {products.slice(0, 4).map((p, i) => (
          <ProductCard key={p.id} product={p} priority={priority && i < 4} />
        ))}
      </div>
    </section>
  );
}

// NOT named `Promise` — that would shadow the global inside this module and
// quietly break the `Promise.all` above.
function TrustPoint({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
        <span className="flex size-5 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <svg viewBox="0 0 24 24" fill="none" className="size-3" aria-hidden>
            <path
              d="m5 13 4 4L19 7"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {title}
      </h3>
      <p className="mt-1.5 text-sm text-ink-soft">{body}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-brand-600/60 px-3 py-1 font-medium text-white ring-1 ring-brand-400/40 ring-inset">
      {children}
    </span>
  );
}

function EmptyCatalogue() {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
      <h2 className="text-lg font-medium text-ink">The catalogue is empty</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
        Nothing is published yet. Follow the seed steps in{" "}
        <code className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-800">
          docs/STOREFRONT.md
        </code>
        .
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
