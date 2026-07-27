"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sanitizeError } from "@/lib/guard";

export type AdminRecipe = {
  id: string;
  name: string;
  cuisine: string;
  isDiet: boolean;
  servings: number;
  itemCount: number;
};

export async function getAdminRecipes(): Promise<AdminRecipe[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_admin_recipes");
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    cuisine: String(r.cuisine ?? ""),
    isDiet: Boolean(r.is_diet),
    servings: Number(r.servings ?? 4),
    itemCount: Number(r.item_count ?? 0),
  }));
}

export async function createRecipe(input: {
  name: string;
  cuisine: string;
  isDiet: boolean;
  servings: number;
  description: string;
}): Promise<{ ok: boolean; id?: string; message?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_recipe", {
    p_name: input.name,
    p_cuisine: input.cuisine,
    p_is_diet: input.isDiet,
    p_servings: input.servings,
    p_description: input.description,
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/recipes");
  return { ok: true, id: String(data) };
}

export async function setRecipeImage(
  recipeId: string,
  path: string | null
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_recipe_image", {
    p_recipe: recipeId,
    p_path: path,
  });
  if (!error) revalidatePath("/dashboard/recipes");
  return { ok: !error };
}

export async function setRecipeVideo(
  recipeId: string,
  url: string
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_recipe_video", {
    p_recipe: recipeId,
    p_url: url || null,
  });
  if (!error) revalidatePath("/dashboard/recipes");
  return { ok: !error };
}

export async function addRecipeItem(
  recipeId: string,
  productId: string,
  qty: number
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_recipe_item", {
    p_recipe: recipeId,
    p_product: productId,
    p_qty: qty,
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/recipes");
  return { ok: true };
}
