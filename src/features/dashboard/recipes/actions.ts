"use server";

import * as backend from "@/server/catalogue/staff-recipes";
export type { AdminRecipe } from "@/lib/contracts/staff-recipes";

export async function getAdminRecipes(...args: Parameters<typeof backend.getAdminRecipes>) {
  return backend.getAdminRecipes(...args);
}

export async function createRecipe(...args: Parameters<typeof backend.createRecipe>) {
  return backend.createRecipe(...args);
}

export async function setRecipeImage(...args: Parameters<typeof backend.setRecipeImage>) {
  return backend.setRecipeImage(...args);
}

export async function setRecipeVideo(...args: Parameters<typeof backend.setRecipeVideo>) {
  return backend.setRecipeVideo(...args);
}

export async function addRecipeItem(...args: Parameters<typeof backend.addRecipeItem>) {
  return backend.addRecipeItem(...args);
}
