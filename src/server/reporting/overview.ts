import "server-only";
import type { Overview } from "@/lib/contracts/reporting-overview";
export type { Overview, OverviewLine, StockLine } from "@/lib/contracts/reporting-overview";
/**
 * SERVER ONLY — the owner's business-overview snapshot for the dashboard home.
 * One RPC (business_overview) does the aggregation in the database; this just
 * shapes it. Returns null if it can't be read, so the page degrades gracefully.
 */
/**
 * SERVER ONLY — the owner's business-overview snapshot for the dashboard home.
 * One RPC (business_overview) does the aggregation in the database; this just
 * shapes it. Returns null if it can't be read, so the page degrades gracefully.
 */
import { num } from "@/lib/format";
import { createClient } from "@/server/supabase/server";
import { isUuid } from "@/lib/guard";
import type { ManagerDashboard } from "@/lib/contracts/staff-access";

export async function getManagerDashboard(location: string | null): Promise<ManagerDashboard> {
  if (location !== null && !isUuid(location)) throw new Error("Choose a valid store.");
  const db = await createClient();
  const { data, error } = await db.rpc("manager_dashboard", { p_location: location });
  if (error || !data) throw new Error("Operations dashboard is temporarily unavailable.");
  return data as ManagerDashboard;
}

export async function getBusinessOverview(): Promise<Overview | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("business_overview");
    if (!data) return null;
    const d = data as Record<string, unknown>;
    const top = Array.isArray(d.top_products) ? d.top_products : [];
    const low = Array.isArray(d.low_stock) ? d.low_stock : [];
    return {
      revenueToday: num(d.revenue_today),
      ordersToday: num(d.orders_today),
      openOrders: num(d.open_orders),
      revenueWeek: num(d.revenue_week),
      topProducts: (top as Record<string, unknown>[]).map((t) => ({
        name: String(t.name ?? ""),
        qty: num(t.qty),
        revenue: num(t.revenue),
      })),
      lowStock: (low as Record<string, unknown>[]).map((s) => ({
        name: String(s.name ?? ""),
        onHand: num(s.on_hand),
        unit: String(s.unit ?? ""),
      })),
      pointsOutstanding: num(d.points_outstanding),
      loyaltyMembers: num(d.loyalty_members),
      activeSubscriptions: num(d.active_subscriptions),
      totalCustomers: num(d.total_customers),
      repeatCustomers: num(d.repeat_customers),
    };
  } catch {
    return null;
  }
}
