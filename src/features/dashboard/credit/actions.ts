"use server";

import * as backend from "@/server/payments/staff-credit";
export type { PaymentResult } from "@/lib/contracts/staff-credit";

export async function collectPayment(...args: Parameters<typeof backend.collectPayment>) {
  return backend.collectPayment(...args);
}
