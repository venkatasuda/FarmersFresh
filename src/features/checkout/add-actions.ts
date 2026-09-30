"use server";

import * as backend from "@/server/orders/checkout-add";

export async function addToOrder(...args: Parameters<typeof backend.addToOrder>) {
  return backend.addToOrder(...args);
}
