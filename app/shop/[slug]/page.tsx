import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToBasket } from "@/app/(shop)/add-to-basket";
import { ProductImage } from "@/app/(shop)/product-image";
import { ShopShell } from "@/app/(shop)/shop-shell";
import { formatRupees, getProductBySlug } from "@/lib/shop";

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

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {product.name}
          </h1>

          <p className="mt-3 text-2xl font-semibold text-ink">
            {formatRupees(product.salePrice)}
            <span className="ml-1 text-base font-normal text-ink-soft">
              / {product.unit}
            </span>
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
            <Fact label="Weight">
              Cuts are weighed fresh, so the final weight may vary slightly from
              what you order. You pay for what you receive.
            </Fact>
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
