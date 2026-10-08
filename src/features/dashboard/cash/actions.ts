"use server";
import * as backend from "@/server/reporting/staff-cash";
export async function collectCod(...args: Parameters<typeof backend.collectCod>) { return backend.collectCod(...args); }
export async function closeCashDay(...args: Parameters<typeof backend.closeCashDay>) { return backend.closeCashDay(...args); }
export async function refundReturnCash(...args: Parameters<typeof backend.refundReturnCash>) { return backend.refundReturnCash(...args); }
export async function openCashShift(...args: Parameters<typeof backend.openCashShift>) { return backend.openCashShift(...args); }
export async function closeCashShift(...args: Parameters<typeof backend.closeCashShift>) { return backend.closeCashShift(...args); }
