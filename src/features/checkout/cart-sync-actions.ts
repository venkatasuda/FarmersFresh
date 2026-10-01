"use server";

import * as backend from "@/server/orders/checkout-cart-sync";

export async function saveCart(...args: Parameters<typeof backend.saveCart>) {
  return backend.saveCart(...args);
}

export async function clearCart(...args: Parameters<typeof backend.clearCart>) {
  return backend.clearCart(...args);
}
