import { ProductCard } from "@/app/(shop)/product-card";
import { getReorderProducts } from "./reorder-actions";

/**
 * "Buy it again" — the customer's previously ordered products, still available.
 * A server component so it renders with the account page; each card carries the
 * normal add-to-basket. Renders nothing if they've no reorderable history.
 */
export async function BuyAgain() {
  const products = await getReorderProducts();
  if (products.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
        <span className="h-5 w-1 rounded-full bg-brand-500" />
        Buy it again
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
