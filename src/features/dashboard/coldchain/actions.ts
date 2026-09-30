"use server";

import * as backend from "@/server/inventory/staff-coldchain";
export type { ColdChain, TempReading } from "@/lib/contracts/staff-coldchain";

export async function getColdChain(...args: Parameters<typeof backend.getColdChain>) {
  return backend.getColdChain(...args);
}

export async function logTemperature(...args: Parameters<typeof backend.logTemperature>) {
  return backend.logTemperature(...args);
}
