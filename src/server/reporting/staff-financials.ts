import "server-only";
import type { Financials, FinOverview } from "@/lib/contracts/staff-financials";
import { createClient } from "@/server/supabase/server";
import { hasPermission } from "@/server/auth/permissions";

export async function getFinancials(days = 30): Promise<Financials> {
  if (![7, 30, 90].includes(days)) throw new Error("Choose a supported reporting period.");
  if (!await hasPermission("financials.read")) throw new Error("Insufficient permission.");
  const supabase = await createClient();
  // Fail closed if a preview runs before its database scope migration is applied.
  const scope = await supabase.rpc("financial_report_locations");
  if (scope.error || !Array.isArray(scope.data) || !scope.data.length) {
    throw new Error("Financial reports are temporarily unavailable.");
  }
  const [ov, mg, pay, pc] = await Promise.all([
    supabase.rpc("financials_overview", { p_days: days }),
    supabase.rpc("margin_by_product", { p_days: days }),
    supabase.rpc("sales_by_payment", { p_days: days }),
    supabase.rpc("price_check", { p_threshold: 10 }),
  ]);

  if ([ov, mg, pay, pc].some(result => result.error || result.data === null)) {
    throw new Error("Financial reports are temporarily unavailable.");
  }

  const o = (ov.data ?? {}) as Record<string, unknown>;
  const overview: FinOverview = {
    revenue: Number(o.revenue ?? 0),
    cogs: Number(o.cogs ?? 0),
    grossProfit: Number(o.gross_profit ?? 0),
    marginPct: Number(o.margin_pct ?? 0),
    costedPct: Number(o.costed_pct ?? 0),
    orderCount: Number(o.order_count ?? 0),
  };

  const margins = ((mg.data ?? []) as Record<string, unknown>[]).map((m) => ({
    productName: String(m.product_name ?? ""),
    units: Number(m.units ?? 0),
    revenue: Number(m.revenue ?? 0),
    cost: Number(m.cost ?? 0),
    profit: Number(m.profit ?? 0),
    marginPct: Number(m.margin_pct ?? 0),
    salePrice: Number(m.sale_price ?? 0),
    lastCost: m.last_cost === null || m.last_cost === undefined ? null : Number(m.last_cost),
  }));

  const payments = ((pay.data ?? []) as Record<string, unknown>[]).map((p) => ({
    paymentMethod: String(p.payment_method ?? "unknown"),
    orders: Number(p.orders ?? 0),
    revenue: Number(p.revenue ?? 0),
  }));

  const alerts = ((pc.data ?? []) as Record<string, unknown>[]).map((a) => ({
    productName: String(a.product_name ?? ""),
    salePrice: Number(a.sale_price ?? 0),
    lastCost: a.last_cost === null || a.last_cost === undefined ? null : Number(a.last_cost),
    marginPct: Number(a.margin_pct ?? 0),
  }));

  return { overview, margins, payments, alerts };
}
