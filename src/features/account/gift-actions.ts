"use server";

import * as backend from "@/server/loyalty/account-gift";

export async function redeemGiftCard(...args: Parameters<typeof backend.redeemGiftCard>) {
  return backend.redeemGiftCard(...args);
}
