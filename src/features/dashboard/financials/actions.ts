"use server";

import * as backend from "@/server/reporting/staff-financials";
export type { FinOverview, Financials, MarginRow, PaymentRow, PriceAlert } from "@/lib/contracts/staff-financials";

export async function getFinancials(...args: Parameters<typeof backend.getFinancials>) {
  return backend.getFinancials(...args);
}
