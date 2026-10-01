"use server";

import * as backend from "@/server/catalogue/search-search";
export type { Suggestion } from "@/lib/contracts/search-search";

export async function suggestProducts(...args: Parameters<typeof backend.suggestProducts>) {
  return backend.suggestProducts(...args);
}
