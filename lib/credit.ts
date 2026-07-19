/**
 * SERVER ONLY — imports the Supabase server client. See `lib/shop.ts`.
 * The credit ledger: who owes, how much, and their recent account activity.
 */
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";
import type { CustomerBalance, LedgerEntry } from "@/lib/types";

/**
 * Debtors, most-owed first. Reads `customer_balances` (migration 0001), which
 * is billed-minus-paid per customer under RLS — so this only ever shows the
 * caller's own customers.
 */
export async function getDebtors(): Promise<CustomerBalance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_balances")
    .select("customer_id, name, phone, total_billed, total_paid, outstanding")
    .order("outstanding", { ascending: false });

  if (error) {
    console.error("getDebtors failed:", error.message);
    return [];
  }

  return (
    (data ?? []) as {
      customer_id: string;
      name: string;
      phone: string | null;
      total_billed: string | number;
      total_paid: string | number;
      outstanding: string | number;
    }[]
  ).map((r) => ({
    customerId: r.customer_id,
    name: r.name,
    phone: r.phone,
    totalBilled: num(r.total_billed),
    totalPaid: num(r.total_paid),
    outstanding: num(r.outstanding),
  }));
}

export async function getCustomerBalance(
  customerId: string
): Promise<CustomerBalance | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_balances")
    .select("customer_id, name, phone, total_billed, total_paid, outstanding")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (!data) return null;
  const r = data as {
    customer_id: string;
    name: string;
    phone: string | null;
    total_billed: string | number;
    total_paid: string | number;
    outstanding: string | number;
  };
  return {
    customerId: r.customer_id,
    name: r.name,
    phone: r.phone,
    totalBilled: num(r.total_billed),
    totalPaid: num(r.total_paid),
    outstanding: num(r.outstanding),
  };
}

/**
 * A customer's account history — sales (charges) and payments (credits) as
 * one running list, newest first. Two queries stitched together because they
 * live in different tables; a small in-memory merge is simpler and clearer
 * than a SQL union view for this volume.
 */
export async function getCustomerLedger(
  customerId: string
): Promise<LedgerEntry[]> {
  const supabase = await createClient();

  const [sales, payments] = await Promise.all([
    supabase
      .from("sales")
      .select("id, total, sale_date")
      .eq("customer_id", customerId)
      .order("sale_date", { ascending: false })
      .limit(50),
    supabase
      .from("payments")
      .select("id, amount, method, paid_at, sale_id")
      .eq("customer_id", customerId)
      .order("paid_at", { ascending: false })
      .limit(50),
  ]);

  const entries: LedgerEntry[] = [];

  for (const s of (sales.data ?? []) as {
    id: string;
    total: string | number;
    sale_date: string;
  }[]) {
    entries.push({
      id: `sale-${s.id}`,
      kind: "charge",
      amount: num(s.total),
      method: null,
      at: s.sale_date,
    });
  }

  for (const p of (payments.data ?? []) as {
    id: string;
    amount: string | number;
    method: string;
    paid_at: string;
    sale_id: string | null;
  }[]) {
    entries.push({
      id: `pay-${p.id}`,
      kind: "payment",
      amount: num(p.amount),
      method: p.method,
      at: p.paid_at,
    });
  }

  return entries.sort((a, b) => (a.at < b.at ? 1 : -1));
}
