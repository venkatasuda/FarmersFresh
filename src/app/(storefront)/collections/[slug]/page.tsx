import { CollectionPageView } from "@/features/shop/collection-view";
import { getCatalogueByCategory, getCategories } from "@/server/catalogue/storefront";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const category = (await getCategories()).find((c) => c.slug === slug);
  return {
    title: category
      ? `${category.name} · Farmers Fresh`
      : "Not found · Farmers Fresh",
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;

  const [products, categories] = await Promise.all([
    getCatalogueByCategory(slug),
    getCategories(),
  ]);

  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const parent = category.parentId
    ? categories.find((c) => c.id === category.parentId)
    : null;

  // Sibling subcategories, for jumping sideways within a department.
  const siblings = categories.filter(
    (c) =>
      c.parentId === (category.parentId ?? category.id) &&
      c.productCount > 0 &&
      c.id !== category.id
  );

  // Children, when this IS a department.
  const children = categories.filter(
    (c) => c.parentId === category.id && c.productCount > 0
  );

  return <CollectionPageView parent={parent} category={category} products={products} subcategories={children} siblings={siblings} />;
}
