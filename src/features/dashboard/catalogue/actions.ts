"use server";

import * as backend from "@/server/catalogue/staff-catalogue";
export type { ProductInput, SaveResult } from "@/lib/contracts/staff-catalogue";

export async function saveProduct(...args: Parameters<typeof backend.saveProduct>) {
  return backend.saveProduct(...args);
}

export async function retireProduct(...args: Parameters<typeof backend.retireProduct>) {
  return backend.retireProduct(...args);
}

export async function togglePublished(...args: Parameters<typeof backend.togglePublished>) {
  return backend.togglePublished(...args);
}
