"use server";

import * as backend from "@/server/inventory/staff-expiry";
export type { ExpiringBatch } from "@/lib/contracts/staff-expiry";

export async function getExpiring(...args: Parameters<typeof backend.getExpiring>) {
  return backend.getExpiring(...args);
}

export async function markDown(...args: Parameters<typeof backend.markDown>) {
  return backend.markDown(...args);
}

export async function writeOffBatch(...args: Parameters<typeof backend.writeOffBatch>) {
  return backend.writeOffBatch(...args);
}
