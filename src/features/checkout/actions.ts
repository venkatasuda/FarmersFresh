"use server";

import * as backend from "@/server/orders/checkout";
export type { CheckoutPrefill, PaymentMethod, PlaceOrderResult, SavedAddress, SubmittedLine } from "@/lib/contracts/checkout";

export async function getMyAddresses(...args: Parameters<typeof backend.getMyAddresses>) {
  return backend.getMyAddresses(...args);
}

export async function getCheckoutPrefill(...args: Parameters<typeof backend.getCheckoutPrefill>) {
  return backend.getCheckoutPrefill(...args);
}

export async function checkPincode(...args: Parameters<typeof backend.checkPincode>) {
  return backend.checkPincode(...args);
}

export async function previewCoupon(...args: Parameters<typeof backend.previewCoupon>) {
  return backend.previewCoupon(...args);
}

export async function attachOrderLocation(...args: Parameters<typeof backend.attachOrderLocation>) {
  return backend.attachOrderLocation(...args);
}

export async function placeOrder(...args: Parameters<typeof backend.placeOrder>) {
  return backend.placeOrder(...args);
}
