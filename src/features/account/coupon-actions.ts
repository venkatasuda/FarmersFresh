"use server";

import * as backend from "@/server/loyalty/account-coupon";
export type { MyCoupon } from "@/lib/contracts/account-coupon";

export async function getMyCoupons(...args: Parameters<typeof backend.getMyCoupons>) {
  return backend.getMyCoupons(...args);
}
