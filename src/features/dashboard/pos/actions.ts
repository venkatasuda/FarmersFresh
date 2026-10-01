"use server";

import * as backend from "@/server/orders/staff-pos";
export type { LoyaltyMember, SaleLine, SaleResult } from "@/lib/contracts/staff-pos";

export async function lookupLoyalty(...args: Parameters<typeof backend.lookupLoyalty>) {
  return backend.lookupLoyalty(...args);
}

export async function recordSale(...args: Parameters<typeof backend.recordSale>) {
  return backend.recordSale(...args);
}

export async function findOrCreateCustomer(...args: Parameters<typeof backend.findOrCreateCustomer>) {
  return backend.findOrCreateCustomer(...args);
}
