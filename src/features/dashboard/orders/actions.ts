"use server";

import * as backend from "@/server/orders/staff-orders";
export type { ActionResult } from "@/lib/contracts/staff-orders";

export async function instantRefund(...args: Parameters<typeof backend.instantRefund>) {
  return backend.instantRefund(...args);
}

export async function advanceOrder(...args: Parameters<typeof backend.advanceOrder>) {
  return backend.advanceOrder(...args);
}

export async function cancelOrder(...args: Parameters<typeof backend.cancelOrder>) {
  return backend.cancelOrder(...args);
}
