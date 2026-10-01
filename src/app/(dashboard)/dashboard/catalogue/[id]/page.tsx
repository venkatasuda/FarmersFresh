import { EditProductPageView } from "@/features/dashboard/catalogue/detail-view";
import { requireSession } from "@/server/auth/session";
import { getAdminCategories, getAdminProduct, getBrands, } from "@/server/catalogue/queries";
import { notFound } from "next/navigation";

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

  return <EditProductPageView product={product} categories={categories} brands={brands} />;
}
