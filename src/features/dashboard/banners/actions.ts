"use server";

import * as backend from "@/server/catalogue/staff-banners";
export type { BannerResult } from "@/lib/contracts/staff-banners";

export async function createBanner(...args: Parameters<typeof backend.createBanner>) {
  return backend.createBanner(...args);
}

export async function toggleBanner(...args: Parameters<typeof backend.toggleBanner>) {
  return backend.toggleBanner(...args);
}

export async function deleteBanner(...args: Parameters<typeof backend.deleteBanner>) {
  return backend.deleteBanner(...args);
}
