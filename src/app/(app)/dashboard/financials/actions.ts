"use server";

import { createClient } from "@/lib/supabase/server";

export type FinOverview = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  costedPct: number;
  orderCount: number;
};

export type MarginRow = {
  productName: string;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  salePrice: number;
  lastCost: number | null;
};

export type PaymentRow = {
  paymentMethod: string;
  orders: number;
  revenue: number;
};

export type PriceAlert = {
  productName: string;
  salePrice: number;
  lastCost: number | null;
  marginPct: number;
};

export type Financials = {
  overview: FinOverview;
  margins: MarginRow[];
  payments: PaymentRow[];
  alerts: PriceAlert[];
};

export async function getFinancials(days = 30): Promise<Financials> {
  const supabase = await createClient();
  const [ov, mg, pay, pc] = await Promise.all([
    supabase.rpc("financials_overview", { p_days: days }),
    supabase.rpc("margin_by_product", { p_days: days }),
    supabase.rpc("sales_by_payment", { p_days: days }),
    supabase.rpc("price_check", { p_threshold: 10 }),
  ]);

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
