/**
 * SERVER ONLY — demand forecast + reorder suggestions.
 *
 * The baseline (a trailing daily-average projection) is computed in the
 * database by reorder_suggestions(). This module is the PLUGGABLE SEAM: set
 * FORECAST_PROVIDER=custom and FORECAST_ENDPOINT_URL to your own model and its
 * predictions replace the baseline — no other app change. The endpoint receives
 * each product's recent average daily demand and returns its own predicted
 * average; we re-derive the cover-window forecast and the suggested order from
 * that, so on-hand and open-PO netting stay identical. Any failure falls back to
 * the baseline, so the shop never loses its reorder list.
 *
 * Richer history for training/serving is available per product via the
 * demand_series() RPC.
 */
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";

export type ReorderSuggestion = {
  productId: string;
  productName: string;
  avgDaily: number;
  forecast: number;
  onHand: number;
  incoming: number;
  coverDays: number | null;
  suggestedQty: number;
  lastCost: number | null;
  salePrice: number;
};

export type ForecastResult = {
  suggestions: ReorderSuggestion[];
  /** "baseline" (built-in) or "custom" (your model answered). */
  source: "baseline" | "custom";
};

export type ForecastParams = { lookback?: number; horizon?: number; lead?: number };

function mapRow(r: Record<string, unknown>): ReorderSuggestion {
  return {
    productId: String(r.product_id),
    productName: String(r.product_name ?? ""),
    avgDaily: num(r.avg_daily),
    forecast: num(r.forecast),
    onHand: num(r.on_hand),
    incoming: num(r.incoming),
    coverDays: r.cover_days === null || r.cover_days === undefined ? null : num(r.cover_days),
    suggestedQty: num(r.suggested_qty),
    lastCost: r.last_cost === null || r.last_cost === undefined ? null : num(r.last_cost),
    salePrice: num(r.sale_price),
  };
}

export async function getReorderSuggestions(
  params: ForecastParams = {}
): Promise<ForecastResult> {
  const lookback = params.lookback ?? 28;
  const horizon = params.horizon ?? 7;
  const lead = params.lead ?? 2;

  const supabase = await createClient();
  const { data } = await supabase.rpc("reorder_suggestions", {
    p_lookback: lookback,
    p_horizon: horizon,
    p_lead: lead,
  });
  const baseline = ((data ?? []) as Record<string, unknown>[]).map(mapRow);

  // Custom model seam. Only attempted when explicitly configured.
  if (
    process.env.FORECAST_PROVIDER === "custom" &&
    process.env.FORECAST_ENDPOINT_URL &&
    baseline.length > 0
  ) {
    try {
      const resp = await fetch(process.env.FORECAST_ENDPOINT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          horizon,
          lead,
          products: baseline.map((s) => ({
            product_id: s.productId,
            avg_daily: s.avgDaily,
          })),
        }),
        // Never let a slow model hang the dashboard.
        signal: AbortSignal.timeout(4000),
      });
      if (resp.ok) {
        const j = (await resp.json()) as {
          predictions?: { product_id: string; avg_daily: number }[];
        };
        const pred = new Map(
          (j.predictions ?? []).map((p) => [p.product_id, Number(p.avg_daily)])
        );
        if (pred.size > 0) {
          const window = horizon + lead;
          const merged = baseline.map((s) => {
            const a = pred.get(s.productId);
            if (a === undefined || !Number.isFinite(a)) return s;
            const forecast = Math.round(a * window * 100) / 100;
            const suggested = Math.max(
              0,
              Math.round((forecast - s.onHand - s.incoming) * 10) / 10
            );
            const cover =
              a > 0 ? Math.round((s.onHand / a) * 10) / 10 : null;
            return {
              ...s,
              avgDaily: Math.round(a * 1000) / 1000,
              forecast,
              suggestedQty: suggested,
              coverDays: cover,
            };
          });
          merged.sort((x, y) => (x.coverDays ?? Infinity) - (y.coverDays ?? Infinity));
          return { suggestions: merged, source: "custom" };
        }
      }
    } catch {
      // Fall through to baseline — a reorder list always beats none.
    }
  }

  return { suggestions: baseline, source: "baseline" };
}
