"use server";

import * as backend from "@/server/subscriptions/account-subscription";
export type { MySubscription, SubActionResult } from "@/lib/contracts/account-subscription";

export async function getMySubscriptions(...args: Parameters<typeof backend.getMySubscriptions>) {
  return backend.getMySubscriptions(...args);
}

export async function setSubscriptionActive(...args: Parameters<typeof backend.setSubscriptionActive>) {
  return backend.setSubscriptionActive(...args);
}

export async function cancelSubscription(...args: Parameters<typeof backend.cancelSubscription>) {
  return backend.cancelSubscription(...args);
}
