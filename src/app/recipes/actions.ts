"use server";

import { createClient } from "@/lib/supabase/server";

export type RecipeCard = {
  id: string;
  name: string;
  cuisine: string;
  isDiet: boolean;
  servings: number;
  imagePath: string | null;
  cost: number;
  ingredientCount: number;
};
export type RecipeIngredient = {
  productId: string;
  slug: string;
  name: string;
  unit: "kg" | "piece";
  price: number;
  imagePath: string | null;
  packSize: number | null;
  qty: number;
  lineCost: number;
};
export type RecipeDetail = {
  id: string;
  name: string;
  cuisine: string;
  isDiet: boolean;
  servings: number;
  description: string | null;
  imagePath: string | null;
  videoUrl: string | null;
  items: RecipeIngredient[];
};

export async function getCuisines(): Promise<{ cuisine: string; n: number }[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_recipe_cuisines");
  return ((data ?? []) as Record<string, unknown>[]).map((c) => ({
    cuisine: String(c.cuisine ?? ""),
    n: Number(c.n ?? 0),
  }));
}

export async function getRecipes(filters: {
  cuisine?: string;
  diet?: string;
  servings: number;
  maxBudget?: number;
}): Promise<RecipeCard[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_recipes", {
    p_cuisine: filters.cuisine || null,
    p_diet: filters.diet || null,
    p_servings: filters.servings,
    p_max_budget: filters.maxBudget && filters.maxBudget > 0 ? filters.maxBudget : null,
  });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    cuisine: String(r.cuisine ?? ""),
    isDiet: Boolean(r.is_diet),
    servings: Number(r.servings ?? 4),
    imagePath: (r.image_path as string | null) ?? null,
    cost: Number(r.cost ?? 0),
    ingredientCount: Number(r.ingredient_count ?? 0),
  }));
}

export async function getRecipeDetail(
  id: string,
  servings: number
): Promise<RecipeDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_recipe", { p_id: id, p_servings: servings });
  if (!data) return null;
  const d = data as Record<string, unknown>;
  const items = Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : [];
  return {
    id: String(d.id),
    name: String(d.name ?? ""),
    cuisine: String(d.cuisine ?? ""),
    isDiet: Boolean(d.is_diet),
    servings: Number(d.servings ?? 4),
    description: (d.description as string | null) ?? null,
    imagePath: (d.image_path as string | null) ?? null,
    videoUrl: (d.video_url as string | null) ?? null,
    items: items.map((i) => ({
      productId: String(i.product_id),
      slug: String(i.slug ?? ""),
      name: String(i.name ?? ""),
      unit: (i.unit as "kg" | "piece") ?? "piece",
      price: Number(i.price ?? 0),
      imagePath: (i.image_path as string | null) ?? null,
      packSize: i.pack_size == null ? null : Number(i.pack_size),
      qty: Number(i.qty ?? 0),
      lineCost: Number(i.line_cost ?? 0),
    })),
  };
}
