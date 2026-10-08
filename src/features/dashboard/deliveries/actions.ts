"use server";

import * as backend from "@/server/delivery/staff-deliveries";

export async function claimDelivery(...args: Parameters<typeof backend.claimDelivery>) {
  return backend.claimDelivery(...args);
}

export async function setDeliveryStatus(...args: Parameters<typeof backend.setDeliveryStatus>) {
  return backend.setDeliveryStatus(...args);
}

export async function updateRiderLocation(...args: Parameters<typeof backend.updateRiderLocation>) {
  return backend.updateRiderLocation(...args);
}

export async function setShift(...args: Parameters<typeof backend.setShift>) {
  return backend.setShift(...args);
}

export async function autoAssign(...args: Parameters<typeof backend.autoAssign>) {
  return backend.autoAssign(...args);
}

export async function reportDeliveryFailure(...args: Parameters<typeof backend.reportDeliveryFailure>) {
  return backend.reportDeliveryFailure(...args);
}

export async function receiveFailedDelivery(...args: Parameters<typeof backend.receiveFailedDelivery>) {
  return backend.receiveFailedDelivery(...args);
}
