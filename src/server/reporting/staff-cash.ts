import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/server/supabase/server";
import { isUuid, sanitizeError, toAmount } from "@/lib/guard";
import type { CashSummary } from "@/lib/contracts/staff-cash";

export function isBusinessDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function validMoney(value: number, max: number) {
  return typeof value === "number" && (value === 0 || toAmount(value, max) === value);
}
export async function getCashLocations(): Promise<{ id: string; name: string; can_collect: boolean; can_close: boolean }[]> {
  const db = await createClient();
  const { data, error } = await db.rpc("cash_locations");
  if (error || !Array.isArray(data)) throw new Error("Cash reconciliation is temporarily unavailable.");
  return data;
}
export async function getCashSummary(location: string, date: string): Promise<CashSummary> {
  if (!isUuid(location) || !isBusinessDate(date)) throw new Error("Choose a valid store and business date.");
  const db = await createClient();
  const { data, error } = await db.rpc("cash_summary", { p_location: location, p_date: date });
  if (error || !data) throw new Error("Cash reconciliation is temporarily unavailable.");
  return data as CashSummary;
}
export async function collectCod(order: string, amount: number) {
  if (!isUuid(order) || !validMoney(amount, 10_000_000) || amount <= 0) return { ok: false, message: "Collect the exact order total." };
  const db = await createClient();
  const { error } = await db.rpc("collect_cod", { p_order: order, p_amount: amount });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/cash"); revalidatePath("/dashboard/orders"); revalidatePath("/dashboard/financials");
  return { ok: true };
}
export async function closeCashDay(location: string, date: string, expected: number, counted: number, note: string) {
  if (!isUuid(location) || !isBusinessDate(date) || !validMoney(expected, 100_000_000) || !validMoney(counted, 100_000_000)) {
    return { ok: false, message: "Enter a valid cash amount." };
  }
  if (typeof note !== "string" || note.length > 500) return { ok: false, message: "Keep the note within 500 characters." };
  const db = await createClient();
  const { error } = await db.rpc("close_cash_day", { p_location: location, p_date: date, p_expected: expected, p_counted: counted, p_note: note.trim() || null });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/cash");
  return { ok: true };
}
