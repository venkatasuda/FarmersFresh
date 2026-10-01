"use server";

import * as backend from "@/server/catalogue/hampers";
export type { HamperCard, HamperDetail, HamperItem } from "@/lib/contracts/hampers";

export async function getHampers(...args: Parameters<typeof backend.getHampers>) {
  return backend.getHampers(...args);
}

export async function getHamperDetail(...args: Parameters<typeof backend.getHamperDetail>) {
  return backend.getHamperDetail(...args);
}
