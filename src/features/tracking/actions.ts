"use server";

import * as backend from "@/server/delivery/tracking";
export type { TrackResult, TrackedItem, TrackedOrder } from "@/lib/contracts/tracking";

export async function rateDelivery(...args: Parameters<typeof backend.rateDelivery>) {
  return backend.rateDelivery(...args);
}

export async function tipDelivery(...args: Parameters<typeof backend.tipDelivery>) {
  return backend.tipDelivery(...args);
}

export async function trackOrder(...args: Parameters<typeof backend.trackOrder>) {
  return backend.trackOrder(...args);
}
