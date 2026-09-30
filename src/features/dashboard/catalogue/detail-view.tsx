import { ProductForm } from "@/features/dashboard/catalogue/product-form";
import Link from "next/link";

type EditProductPageViewProps = {
  product: import("@/lib/types").AdminProduct;
  categories: import("@/lib/types").Category[];
  brands: import("@/lib/types").Brand[];
};

export function EditProductPageView({ product, categories, brands }: EditProductPageViewProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <nav className="text-sm text-ink-soft">
        <Link href="/dashboard/catalogue" className="hover:text-brand-700">
          Catalogue
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {product.name}
        </h1>
        {product.slug && product.isPublished ? (
          <Link
            href={`/shop/${product.slug}`}
            className="text-sm text-brand-700 hover:underline"
          >
            View on shop →
          </Link>
        ) : null}
      </div>

      <ProductForm product={product} categories={categories} brands={brands} />
    </div>
  );
}
