"use server";

import * as backend from "@/server/inventory/shop-stock-alert";

export async function watchStock(...args: Parameters<typeof backend.watchStock>) {
  return backend.watchStock(...args);
}
