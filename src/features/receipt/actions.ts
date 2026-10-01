"use server";

import * as backend from "@/server/orders/receipt";

export async function getReceipt(...args: Parameters<typeof backend.getReceipt>) {
  return backend.getReceipt(...args);
}
