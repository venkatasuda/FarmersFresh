"use server";

import * as backend from "@/server/customers/account-push";

export async function savePushSubscription(...args: Parameters<typeof backend.savePushSubscription>) {
  return backend.savePushSubscription(...args);
}

export async function deletePushSubscription(...args: Parameters<typeof backend.deletePushSubscription>) {
  return backend.deletePushSubscription(...args);
}
