"use server";

import * as backend from "@/server/catalogue/shop-recommend";
export type { MiniProduct } from "@/lib/contracts/shop-recommend";

export async function recentlyViewedProducts(...args: Parameters<typeof backend.recentlyViewedProducts>) {
  return backend.recentlyViewedProducts(...args);
}

export async function cartRecommendations(...args: Parameters<typeof backend.cartRecommendations>) {
  return backend.cartRecommendations(...args);
}
