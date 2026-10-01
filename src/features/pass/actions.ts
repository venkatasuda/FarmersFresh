"use server";

import * as backend from "@/server/subscriptions/pass";
export type { Membership, Plan } from "@/lib/contracts/pass";

export async function getPlans(...args: Parameters<typeof backend.getPlans>) {
  return backend.getPlans(...args);
}

export async function getMyMembership(...args: Parameters<typeof backend.getMyMembership>) {
  return backend.getMyMembership(...args);
}

export async function startMembership(...args: Parameters<typeof backend.startMembership>) {
  return backend.startMembership(...args);
}
