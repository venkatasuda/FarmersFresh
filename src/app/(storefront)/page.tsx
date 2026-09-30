import { ShopHomeView } from "@/features/shop/home-view";
import { buildCategoryTree } from "@/lib/types";
import { getActiveBanners } from "@/server/catalogue/banners";
import { getCatalogue, getCategories, getPersonalizedProducts, getRefillSuggestions, } from "@/server/catalogue/storefront";

export const metadata = {
  title: "Farmers Fresh — Indian groceries & fresh meat, delivered",
};

export default async function ShopHome() {
  const [products, categories, banners, refill, forYou] = await Promise.all([
    getCatalogue(),
    getCategories(),
    getActiveBanners(),
    getRefillSuggestions(),
    getPersonalizedProducts(10),
  ]);

  const tree = buildCategoryTree(categories);
  const byCategory = new Map(categories.map((c) => [c.slug, c]));

  // Merchandising rows. With 35 products across 13 departments, one flat grid
  // is a wall — a customer needs a reason to click something.
  const deals = products.filter((p) => p.compareAtPrice !== null);
  const meat = products.filter((p) => p.categorySlug === "mutton");

  return <ShopHomeView banners={banners} products={products} refill={refill} forYou={forYou} tree={tree} meat={meat} deals={deals} byCategory={byCategory} />;
}

// NOT named `Promise` — that would shadow the global inside this module and
// quietly break the `Promise.all` above.
