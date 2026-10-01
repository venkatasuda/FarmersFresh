import { CataloguePageView } from "@/features/dashboard/catalogue/catalogue-view";
import { requireSession } from "@/server/auth/session";
import { getAdminCategories, getAdminProducts } from "@/server/catalogue/queries";

export const metadata = { title: "Catalogue · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ retired?: string }>;
}) {
  const session = await requireSession();
  const { retired } = await searchParams;
  const showRetired = retired === "1";

  const [products, categories] = await Promise.all([
    getAdminProducts(showRetired),
    getAdminCategories(),
  ]);

  const parentName = (id: string | null) => {
    const c = categories.find((x) => x.id === id);
    if (!c) return "Uncategorised";
    const parent = categories.find((p) => p.id === c.parentId);
    return parent ? `${parent.name} → ${c.name}` : c.name;
  };

  const live = products.filter((p) => p.isPublished);
  const noPrice = products.filter((p) => p.salePrice === null && p.isActive);

  if (!session.isOwner) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <h1 className="text-lg font-medium text-ink">Owners only</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
          Changing prices and products is restricted to the account owner.
        </p>
      </div>
    );
  }

  return <CataloguePageView live={live} products={products} showRetired={showRetired} noPrice={noPrice} parentName={parentName} />;
}
