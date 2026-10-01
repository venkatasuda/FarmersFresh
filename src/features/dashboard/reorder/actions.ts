"use server";

import * as backend from "@/server/procurement/staff-reorder";

export async function getSuggestions(...args: Parameters<typeof backend.getSuggestions>) {
  return backend.getSuggestions(...args);
}

export async function createDraftFromSuggestions(...args: Parameters<typeof backend.createDraftFromSuggestions>) {
  return backend.createDraftFromSuggestions(...args);
}
