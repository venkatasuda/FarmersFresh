"use server";

import * as backend from "@/server/loyalty/staff-coupons";
export type { CouponResult } from "@/lib/contracts/staff-coupons";

export async function createCoupon(...args: Parameters<typeof backend.createCoupon>) {
  return backend.createCoupon(...args);
}

export async function grantPersonalCoupon(...args: Parameters<typeof backend.grantPersonalCoupon>) {
  return backend.grantPersonalCoupon(...args);
}

export async function issueGiftCard(...args: Parameters<typeof backend.issueGiftCard>) {
  return backend.issueGiftCard(...args);
}

export async function toggleCoupon(...args: Parameters<typeof backend.toggleCoupon>) {
  return backend.toggleCoupon(...args);
}
