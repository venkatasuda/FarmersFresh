import { ProductGridSkeleton } from "@/features/shop/product-skeleton";

export default function StorefrontLoading() {
  return (
    <div className="py-6">
      <div className="mb-8 h-40 animate-pulse rounded-3xl bg-brand-100" />
      <div className="mb-4 h-6 w-40 animate-pulse rounded bg-line" />
      <ProductGridSkeleton count={8} />
    </div>
  );
}
