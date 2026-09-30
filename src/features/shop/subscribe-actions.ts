"use server";

import * as backend from "@/server/subscriptions/shop-subscribe";
export type { SubResult } from "@/lib/contracts/shop-subscribe";

export async function createSubscription(...args: Parameters<typeof backend.createSubscription>) {
  return backend.createSubscription(...args);
}
