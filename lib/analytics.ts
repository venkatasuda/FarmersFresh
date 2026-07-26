/**
 * SERVER ONLY — imports the Supabase server client. See `lib/shop.ts`.
 * The owner's sales summary, computed entirely in the database.
 */
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";

export type SalesSummary = {
  todaySales: number;
  todayCount: number;
  weekSales: number;
  todayCollected: number;
  outstanding: number;
  openOrders: number;
  methodSplit: { method: string; amount: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  lowStock: { name: string; qty: number }[];
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank",
  other: "Other",
};

export function methodLabel(m: string): string {
  return METHOD_LABELS[m] ?? m;
}

export type DemandInsights = {
  byWeekday: { day: string; revenue: number }[];
  reorder: { name: string; onHand: number; perDay: number; daysLeft: number | null }[];
  thisWeek: number;
  lastWeek: number;
};

export async function getDemandInsights(): Promise<DemandInsights | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("demand_insights");
  if (error || !data) return null;

  const d = data as Record<string, unknown>;
  return {
    byWeekday: ((d.by_weekday as unknown[]) ?? []).map((w) => {
      const it = w as Record<string, unknown>;
      return { day: String(it.day).trim(), revenue: num(it.revenue) };
    }),
    reorder: ((d.reorder as unknown[]) ?? []).map((rr) => {
      const it = rr as Record<string, unknown>;
      return {
        name: String(it.name),
        onHand: num(it.on_hand),
        perDay: num(it.per_day),
        daysLeft: it.days_left === null ? null : num(it.days_left),
      };
    }),
    thisWeek: num(d.this_week),
    lastWeek: num(d.last_week),
  };
}

export async function getSalesSummary(): Promise<SalesSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sales_summary");

  if (error || !data) {
    // Non-owners get an error from the function; treat as "no dashboard".
    return null;
  }

  const d = data as Record<string, unknown>;
  const split = (d.method_split ?? {}) as Record<string, unknown>;

  return {
    todaySales: num(d.today_sales),
    todayCount: num(d.today_count),
    weekSales: num(d.week_sales),
    todayCollected: num(d.today_collected),
    outstanding: num(d.outstanding),
    openOrders: num(d.open_orders),
    methodSplit: Object.entries(split)
      .map(([method, amount]) => ({ method, amount: num(amount) }))
      .sort((a, b) => b.amount - a.amount),
    topProducts: ((d.top_products as unknown[]) ?? []).map((p) => {
      const it = p as Record<string, unknown>;
      return {
        name: String(it.name),
        qty: num(it.qty),
        revenue: num(it.revenue),
      };
    }),
    lowStock: ((d.low_stock as unknown[]) ?? []).map((p) => {
      const it = p as Record<string, unknown>;
      return { name: String(it.name), qty: num(it.qty) };
    }),
  };
}
