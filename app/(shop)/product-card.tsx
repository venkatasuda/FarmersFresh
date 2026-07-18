import Link from "next/link";
import { AddToBasket } from "./add-to-basket";
import { ProductImage } from "./product-image";
import type { ShopProduct } from "@/lib/shop";
import { formatRupees } from "@/lib/shop";

export function ProductCard({
  product,
  priority = false,
}: {
  product: ShopProduct;
  priority?: boolean;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/shop/${product.slug}`}
        className="relative aspect-4/3 overflow-hidden bg-brand-50"
      >
        <ProductImage
          src={product.imagePath}
          alt={product.name}
          priority={priority}
          className={`h-full w-full transition-transform duration-300 group-hover:scale-105 ${
            product.inStock ? "" : "opacity-45 grayscale"
          }`}
        />
        {!product.inStock ? (
          <span className="absolute top-2 left-2 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-medium text-white">
            Sold out
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex-1">
          {product.category ? (
            <p className="text-xs font-medium tracking-wide text-brand-600 uppercase">
              {product.category}
            </p>
          ) : null}
          <h3 className="mt-0.5 font-medium text-ink">
            <Link href={`/shop/${product.slug}`} className="hover:text-brand-700">
              {product.name}
            </Link>
          </h3>
          {product.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
              {product.description}
            </p>
          ) : null}
        </div>

        <p className="text-lg font-semibold text-ink">
          {formatRupees(product.salePrice)}
          <span className="ml-1 text-sm font-normal text-ink-soft">
            / {product.unit}
          </span>
        </p>

        <AddToBasket product={product} />
      </div>
    </article>
  );
}
