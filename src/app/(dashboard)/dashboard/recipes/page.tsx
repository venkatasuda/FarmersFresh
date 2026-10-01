import { getAdminRecipes } from "@/server/catalogue/staff-recipes";
import { RecipeManager } from "@/features/dashboard/recipes/recipe-manager";
import { requireSession } from "@/server/auth/session";
import { getCatalogue } from "@/server/catalogue/storefront";
import { redirect } from "next/navigation";

export const metadata = { title: "Recipes · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function RecipesAdminPage() {
  const session = await requireSession();
  if (!session.isOwner) redirect("/dashboard");

  const [recipes, catalogue] = await Promise.all([getAdminRecipes(), getCatalogue()]);
  const products = catalogue.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Recipes</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Build dishes from your products. Customers pick servings &amp; budget and
          add every ingredient to their basket in one tap.
        </p>
      </div>
      <RecipeManager recipes={recipes} products={products} />
    </div>
  );
}
