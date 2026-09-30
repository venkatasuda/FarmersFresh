"use server";

import * as backend from "@/server/loyalty/account-scratch";
export type { ScratchCard } from "@/lib/contracts/account-scratch";

export async function getMyScratchCards(...args: Parameters<typeof backend.getMyScratchCards>) {
  return backend.getMyScratchCards(...args);
}

export async function revealScratchCard(...args: Parameters<typeof backend.revealScratchCard>) {
  return backend.revealScratchCard(...args);
}
