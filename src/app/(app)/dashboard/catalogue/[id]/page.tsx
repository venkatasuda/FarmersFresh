import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "../product-form";
import { requireSession } from "@/lib/auth";
import {
  getAdminCategories,
  getAdminProduct,
  getBrands,
} from "@/lib/catalogue";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const product = await getAdminProduct(id);
  return { title: product ? `${product.name} · Farmers Fresh` : "Not found" };
}

export default async function EditProductPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;

  if (!session.isOwner) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <h1 className="text-lg font-medium text-ink">Owners only</h1>
      </div>
    );
  }

  const [product, categories, brands] = await Promise.all([
    getAdminProduct(id),
    getAdminCategories(),
    getBrands(),
  ]);

  if (!product) notFound();

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
