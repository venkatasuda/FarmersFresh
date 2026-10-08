"use server";

import * as backend from "@/server/inventory/staff-stock";
export type { StockResult } from "@/lib/contracts/staff-stock";

export async function recordStock(...args: Parameters<typeof backend.recordStock>) {
  return backend.recordStock(...args);
}
export async function countStock(...args: Parameters<typeof backend.countStock>) { return backend.countStock(...args); }
export async function dispatchTransfer(...args: Parameters<typeof backend.dispatchTransfer>) { return backend.dispatchTransfer(...args); }
export async function receiveTransfer(...args: Parameters<typeof backend.receiveTransfer>) { return backend.receiveTransfer(...args); }
