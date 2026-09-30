"use server";

import * as backend from "@/server/orders/staff-returns";
export type { ReturnRow } from "@/lib/contracts/staff-returns";

export async function getReturns(...args: Parameters<typeof backend.getReturns>) {
  return backend.getReturns(...args);
}

export async function approveReturn(...args: Parameters<typeof backend.approveReturn>) {
  return backend.approveReturn(...args);
}

export async function rejectReturn(...args: Parameters<typeof backend.rejectReturn>) {
  return backend.rejectReturn(...args);
}
