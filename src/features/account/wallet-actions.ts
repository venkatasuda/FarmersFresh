"use server";

import * as backend from "@/server/loyalty/account-wallet";
export type { Savings, Wallet } from "@/lib/contracts/account-wallet";

export async function getMySavings(...args: Parameters<typeof backend.getMySavings>) {
  return backend.getMySavings(...args);
}

export async function getMyWallet(...args: Parameters<typeof backend.getMyWallet>) {
  return backend.getMyWallet(...args);
}

export async function redeemReferral(...args: Parameters<typeof backend.redeemReferral>) {
  return backend.redeemReferral(...args);
}
