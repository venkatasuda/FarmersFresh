import { AddToBasket } from "@/features/cart/add-to-basket";
import { MobileBuyBar } from "@/features/cart/mobile-buy-bar";
import { Reviews } from "@/features/reviews/reviews";
import { Stars } from "@/features/reviews/stars";
import { NotifyMe } from "@/features/shop/notify-me";
import { ProductCard } from "@/features/shop/product-card";
import { ProductImage } from "@/features/shop/product-image";
import { RecentlyViewed } from "@/features/shop/recently-viewed";
import { SubscribeBox } from "@/features/shop/subscribe-box";
import { TrackView } from "@/features/shop/track-view";
import { formatRupees } from "@/lib/format";
import { discountPercent, packLabel, unitPrice } from "@/lib/types";
import Link from "next/link";

type ProductPageViewProps = {
  product: import("@/lib/types").ShopProduct;
  subscriptionDiscountPct: number;
  goesWith: import("@/lib/types").ShopProduct[];
};

export function ProductPageView({ product, subscriptionDiscountPct, goesWith }: ProductPageViewProps) {
  return (
    <>
      {/* Records this view for the recently-viewed feed (client-side only). */}
      <TrackView productId={product.id} />
      {/* Room at the bottom on mobile so the fixed buy bar never covers the
          last line of content. */}
      <div className="pb-24 sm:pb-0">
      <nav className="mb-5 text-sm text-ink-soft">
        <Link href="/" className="hover:text-brand-700">
          Shop
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="relative aspect-4/3 overflow-hidden rounded-2xl border border-line bg-brand-50">
          <ProductImage src={product.imagePath} alt={product.name} priority />
        </div>

        <div>
          {product.category ? (
            <p className="text-xs font-medium tracking-wide text-brand-600 uppercase">
              {product.category}
            </p>
          ) : null}
          {/* The brand promise earns its place HERE, where someone is deciding,
              rather than repeated on every card in the grid. */}
          {product.brand ? (
            <p className="mt-1 text-sm text-ink-soft">
              <span className="font-medium text-ink">{product.brand}</span>
              {product.brandTagline ? ` · ${product.brandTagline}` : null}
            </p>
          ) : null}

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {product.name}
          </h1>

          {product.avgRating !== null ? (
            <a href="#reviews" className="mt-1.5 inline-flex items-center gap-1.5">
              <Stars rating={product.avgRating} className="size-4" />
              <span className="text-sm text-ink-soft">
                {product.avgRating} · {product.reviewCount}{" "}
                {product.reviewCount === 1 ? "review" : "reviews"}
              </span>
            </a>
          ) : null}

          {packLabel(product) ? (
            <p className="mt-1 text-sm text-ink-soft">{packLabel(product)}</p>
          ) : null}

          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-ink">
              {formatRupees(product.salePrice)}
            </span>
            {product.compareAtPrice ? (
              <>
                <span className="text-base text-ink-soft line-through">
                  {formatRupees(product.compareAtPrice)}
                </span>
                <span className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {discountPercent(product)}% off
                </span>
              </>
            ) : null}
          </div>
          <p className="text-sm text-ink-soft">
            {unitPrice(product)
              ? `${formatRupees(unitPrice(product)!.value)} per ${unitPrice(product)!.per}`
              : `per ${product.unit}`}
          </p>

          {product.description ? (
            <p className="mt-4 text-ink-soft">{product.description}</p>
          ) : null}

          <div className="mt-6 max-w-xs">
            <AddToBasket product={product} />
          </div>

          {/* Sold out — recover the sale by letting them ask to be told when
              it's back, instead of just leaving. */}
          {!product.inStock ? (
            <div className="mt-4 max-w-sm">
              <NotifyMe productId={product.id} />
            </div>
          ) : null}

          {/* Repeat-delivery: the retention lever grocery apps lean on. Only
              useful for logged-in customers, but the control gracefully points
              guests to log in when they try. */}
          <div className="mt-4 max-w-sm">
            <SubscribeBox product={product} discountPct={subscriptionDiscountPct} />
          </div>

          <dl className="mt-8 space-y-3 border-t border-line pt-6 text-sm">
            <Fact label="Delivery">
              Free over ₹500, otherwise ₹40. Same day where we deliver.
            </Fact>
            <Fact label="Payment">Cash or UPI when it reaches you.</Fact>
            <Fact label="Quality">
              Quality assured and fully traceable to source — every batch is
              logged from farm to your door.
            </Fact>
            {/* Only true for loose goods. A sealed 5 kg bag of atta weighs
                5 kg — promising it "may vary" would be nonsense. */}
            {packLabel(product) === null ? (
              <Fact label="Weight">
                Cuts are weighed fresh, so the final weight may vary slightly
                from what you order. You pay for what you receive.
              </Fact>
            ) : (
              <Fact label="Pack">
                Sold as a sealed {packLabel(product)} pack.
              </Fact>
            )}
          </dl>
        </div>
      </div>

      <Reviews
        productId={product.id}
        avgRating={product.avgRating}
        reviewCount={product.reviewCount}
      />

      {goesWith.length > 0 ? (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-ink">
            Goes well with
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {goesWith.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-12">
        <RecentlyViewed excludeId={product.id} />
      </div>
      </div>

      <MobileBuyBar product={product} />
    </>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <dt className="w-24 shrink-0 font-medium text-ink">{label}</dt>
      <dd className="text-ink-soft">{children}</dd>
    </div>
  );
}
