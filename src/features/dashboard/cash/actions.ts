"use server";
import * as backend from "@/server/reporting/staff-cash";
export async function collectCod(...args: Parameters<typeof backend.collectCod>) { return backend.collectCod(...args); }
export async function closeCashDay(...args: Parameters<typeof backend.closeCashDay>) { return backend.closeCashDay(...args); }
