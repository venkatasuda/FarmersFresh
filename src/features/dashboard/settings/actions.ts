"use server";

import * as backend from "@/server/settings/staff-settings";
export type { AdminSettings } from "@/lib/contracts/staff-settings";

export async function getAdminSettings(...args: Parameters<typeof backend.getAdminSettings>) {
  return backend.getAdminSettings(...args);
}

export async function saveSettings(...args: Parameters<typeof backend.saveSettings>) {
  return backend.saveSettings(...args);
}
