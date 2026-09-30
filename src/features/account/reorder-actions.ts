"use server";

import * as backend from "@/server/customers/account-reorder";

export async function getReorderProducts(...args: Parameters<typeof backend.getReorderProducts>) {
  return backend.getReorderProducts(...args);
}
