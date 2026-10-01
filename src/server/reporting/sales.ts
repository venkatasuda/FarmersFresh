import "server-only";
import type { DemandInsights, SalesSummary } from "@/lib/contracts/reporting-sales";
export type { DemandInsights, SalesSummary } from "@/lib/contracts/reporting-sales";
/**
 * SERVER ONLY — imports the Supabase server client. See `lib/shop.ts`.
 * The owner's sales summary, computed entirely in the database.
 */
/**
 * SERVER ONLY — imports the Supabase server client. See `lib/shop.ts`.
 * The owner's sales summary, computed entirely in the database.
 */
import { num } from "@/lib/format";
import { createClient } from "@/server/supabase/server";



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
