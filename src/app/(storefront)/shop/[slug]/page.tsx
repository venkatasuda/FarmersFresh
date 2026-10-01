import { ProductPageView } from "@/features/shop/product-view";
import { getFrequentlyBoughtTogether, getProductBySlug } from "@/server/catalogue/storefront";
import { getSubscriptionDiscountPct } from "@/server/settings/queries";
import { notFound } from "next/navigation";

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

  const [goesWith, subscriptionDiscountPct] = await Promise.all([
    getFrequentlyBoughtTogether(product.id, 4),
    getSubscriptionDiscountPct(),
  ]);

  return <ProductPageView product={product} subscriptionDiscountPct={subscriptionDiscountPct} goesWith={goesWith} />;
}
