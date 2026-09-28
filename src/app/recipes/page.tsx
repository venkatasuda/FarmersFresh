import { ShopShell } from "@/app/(shop)/shop-shell";
import { getCuisines, getRecipes } from "./actions";
import { RecipesBrowser } from "./recipes-browser";

export const metadata = {
  title: "Recipes — shop the dish · Farmers Fresh",
  description: "Pick a dish, set your budget and servings, and add every ingredient to your basket in one tap.",
};
export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const [cuisines, initial] = await Promise.all([
    getCuisines(),
    getRecipes({ servings: 4 }),
  ]);

  return (
    <ShopShell>
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Cook the dish, we&apos;ll fill the basket
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Explore recipes from across India and beyond. Pick your servings and
            budget, then add every ingredient — measured for your table — in one tap.
          </p>
        </div>
        <RecipesBrowser cuisines={cuisines} initial={initial} />
      </div>
    </ShopShell>
  );
}
