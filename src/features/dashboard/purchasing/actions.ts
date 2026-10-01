"use server";

import * as backend from "@/server/procurement/staff-purchasing";
export type { PoDetail, PoItem, PoSummary, ProcurementOverview, Supplier } from "@/lib/contracts/staff-purchasing";

export async function getSuppliers(...args: Parameters<typeof backend.getSuppliers>) {
  return backend.getSuppliers(...args);
}

export async function getPurchaseOrders(...args: Parameters<typeof backend.getPurchaseOrders>) {
  return backend.getPurchaseOrders(...args);
}

export async function getOverview(...args: Parameters<typeof backend.getOverview>) {
  return backend.getOverview(...args);
}

export async function getPurchaseOrder(...args: Parameters<typeof backend.getPurchaseOrder>) {
  return backend.getPurchaseOrder(...args);
}

export async function saveSupplier(...args: Parameters<typeof backend.saveSupplier>) {
  return backend.saveSupplier(...args);
}

export async function setSupplierActive(...args: Parameters<typeof backend.setSupplierActive>) {
  return backend.setSupplierActive(...args);
}

export async function createPurchaseOrder(...args: Parameters<typeof backend.createPurchaseOrder>) {
  return backend.createPurchaseOrder(...args);
}

export async function receivePurchaseOrder(...args: Parameters<typeof backend.receivePurchaseOrder>) {
  return backend.receivePurchaseOrder(...args);
}

export async function cancelPurchaseOrder(...args: Parameters<typeof backend.cancelPurchaseOrder>) {
  return backend.cancelPurchaseOrder(...args);
}
