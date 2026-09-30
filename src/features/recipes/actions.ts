"use server";

import * as backend from "@/server/catalogue/recipes";
export type { RecipeCard, RecipeDetail, RecipeIngredient } from "@/lib/contracts/recipes";

export async function getCuisines(...args: Parameters<typeof backend.getCuisines>) {
  return backend.getCuisines(...args);
}

export async function getRecipes(...args: Parameters<typeof backend.getRecipes>) {
  return backend.getRecipes(...args);
}

export async function getRecipeDetail(...args: Parameters<typeof backend.getRecipeDetail>) {
  return backend.getRecipeDetail(...args);
}
