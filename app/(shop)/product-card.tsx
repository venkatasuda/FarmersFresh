import Link from "next/link";
import { AddToBasket } from "./add-to-basket";
import { ProductImage } from "./product-image";
import { formatRupees } from "@/lib/format";
import {
  discountPercent,
  packLabel,
  unitPrice,
  type ShopProduct,
} from "@/lib/types";

/**
 * The grocery product card: image, badges, name, price block, add button.
 *
 * The price block deliberately puts the SALE price first and largest, with the
 * struck-through "was" price second and smaller. Leading with the crossed-out
 * number reads as a trick; leading with what they'll pay reads as a price.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: ShopProduct;
  priority?: boolean;
}) {
  const off = discountPercent(product);
  const pack = packLabel(product);
  const per = unitPrice(product);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
      <Link
        href={`/shop/${product.slug}`}
        className="relative aspect-square overflow-hidden bg-brand-50"
      >
        <ProductImage
          src={product.imagePath}
          alt={product.name}
          priority={priority}
          className={`h-full w-full transition-transform duration-300 group-hover:scale-105 ${
            product.inStock ? "" : "opacity-45 grayscale"
          }`}
        />

        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {off ? (
            <span className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
              {off}% off
            </span>
          ) : null}
          {product.badge && product.inStock ? (
            <span className="rounded-md bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">
              {product.badge}
            </span>
          ) : null}
        </div>

        {!product.inStock ? (
          <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1.5 text-center text-xs font-medium text-white">
            Sold out today
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div className="flex-1">
          {/* Everything here is house brand, so the brand line is context,
              not a choice. Kept quiet and grey so it doesn't compete with the
              product name on 42 near-identical cards. */}
          {product.brand ? (
            <p className="text-[11px] tracking-wide text-ink-soft uppercase">
              {product.brand}
            </p>
          ) : null}
          <h3 className="mt-0.5 text-sm leading-snug font-medium text-ink sm:text-base">
            <Link href={`/shop/${product.slug}`} className="hover:text-brand-700">
              {product.name}
            </Link>
          </h3>
          {pack ? (
            <p className="mt-0.5 text-xs text-ink-soft">{pack}</p>
          ) : product.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-ink-soft">
              {product.description}
            </p>
          ) : null}
        </div>

        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-ink">
              {formatRupees(product.salePrice)}
            </span>
            {product.compareAtPrice ? (
              <span className="text-sm text-ink-soft line-through">
                {formatRupees(product.compareAtPrice)}
              </span>
            ) : null}
          </div>
          {/* Comparable price. This is how a customer judges a 500 g pack
              against a 1 kg one without doing arithmetic in the aisle. */}
          <p className="text-xs text-ink-soft">
            {per
              ? `${formatRupees(per.value)} / ${per.per}`
              : `per ${product.unit}`}
          </p>
        </div>

        <AddToBasket product={product} />
      </div>
    </article>
  );
}
