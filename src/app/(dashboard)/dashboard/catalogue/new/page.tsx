import { ProductForm } from "@/features/dashboard/catalogue/product-form";
import { requireSession } from "@/server/auth/session";
import { getAdminCategories, getBrands } from "@/server/catalogue/queries";
import Link from "next/link";

export const metadata = { title: "Add product · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const session = await requireSession();

  if (!session.isOwner) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <h1 className="text-lg font-medium text-ink">Owners only</h1>
      </div>
    );
  }

  const [categories, brands] = await Promise.all([
    getAdminCategories(),
    getBrands(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <nav className="text-sm text-ink-soft">
        <Link href="/dashboard/catalogue" className="hover:text-brand-700">
          Catalogue
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">New product</span>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Add a product
      </h1>

      <ProductForm product={null} categories={categories} brands={brands} />
    </div>
  );
}
