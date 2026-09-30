"use server";

import * as backend from "@/server/inventory/staff-production";

export async function recordProduction(...args: Parameters<typeof backend.recordProduction>) {
  return backend.recordProduction(...args);
}
