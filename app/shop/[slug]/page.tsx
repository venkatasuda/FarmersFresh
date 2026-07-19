import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToBasket } from "@/app/(shop)/add-to-basket";
import { ProductImage } from "@/app/(shop)/product-image";
import { ShopShell } from "@/app/(shop)/shop-shell";
import { formatRupees } from "@/lib/format";
import { getProductBySlug } from "@/lib/shop";
import { discountPercent, packLabel, unitPrice } from "@/lib/types";

// Next.js 16: params is a Promise.
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Not found · Farmers Fresh" };
  return {
    title: `${product.name} · Farmers Fresh`,
    description:
      product.description ??
      `${product.name} — fresh from our farms, delivered to your door.`,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  // Unpublished products fail the RLS policy and come back null — so an
  // unlisted item 404s to the public without any extra check here.
  if (!product) notFound();

  return (
    <ShopShell>
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

          <dl className="mt-8 space-y-3 border-t border-line pt-6 text-sm">
            <Fact label="Delivery">
              Free over ₹500, otherwise ₹40. Same day where we deliver.
            </Fact>
            <Fact label="Payment">Cash or UPI when it reaches you.</Fact>
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
    </ShopShell>
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
