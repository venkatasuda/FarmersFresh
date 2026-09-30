"use server";

import * as backend from "@/server/inventory/staff-stock";
export type { StockResult } from "@/lib/contracts/staff-stock";

export async function recordStock(...args: Parameters<typeof backend.recordStock>) {
  return backend.recordStock(...args);
}
