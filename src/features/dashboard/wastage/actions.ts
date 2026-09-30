"use server";

import * as backend from "@/server/inventory/staff-wastage";
export type { WastageRow, WastageSummary } from "@/lib/contracts/staff-wastage";

export async function getWastageList(...args: Parameters<typeof backend.getWastageList>) {
  return backend.getWastageList(...args);
}

export async function getWastageSummary(...args: Parameters<typeof backend.getWastageSummary>) {
  return backend.getWastageSummary(...args);
}

export async function logWastage(...args: Parameters<typeof backend.logWastage>) {
  return backend.logWastage(...args);
}
