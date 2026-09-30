"use server";

import * as backend from "@/server/inventory/staff-traceability";
export type { Batch, Farm, RecallRow } from "@/lib/contracts/staff-traceability";

export async function getFarms(...args: Parameters<typeof backend.getFarms>) {
  return backend.getFarms(...args);
}

export async function addFarm(...args: Parameters<typeof backend.addFarm>) {
  return backend.addFarm(...args);
}

export async function getBatches(...args: Parameters<typeof backend.getBatches>) {
  return backend.getBatches(...args);
}

export async function addBatch(...args: Parameters<typeof backend.addBatch>) {
  return backend.addBatch(...args);
}

export async function recallTrace(...args: Parameters<typeof backend.recallTrace>) {
  return backend.recallTrace(...args);
}
