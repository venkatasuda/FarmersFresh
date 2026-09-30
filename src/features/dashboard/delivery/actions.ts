"use server";

import * as backend from "@/server/delivery/staff-delivery";
export type { ZoneResult } from "@/lib/contracts/staff-delivery";

export async function addZone(...args: Parameters<typeof backend.addZone>) {
  return backend.addZone(...args);
}

export async function removeZone(...args: Parameters<typeof backend.removeZone>) {
  return backend.removeZone(...args);
}

export async function saveNotificationTargets(...args: Parameters<typeof backend.saveNotificationTargets>) {
  return backend.saveNotificationTargets(...args);
}
