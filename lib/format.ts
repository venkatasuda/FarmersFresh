/**
 * Pure formatting and parsing. NO imports, and never any.
 *
 * This file exists because of a real build failure: `lib/shop.ts` held both
 * the Supabase data functions and these formatters, so any Client Component
 * that wanted `formatRupees` also pulled in `next/headers` and broke the
 * production build.
 *
 * RULE: anything a Client Component imports goes here or in `lib/types.ts`.
 * Nothing in either file may import from `lib/supabase/*`.
 */

/**
 * Postgres `numeric` arrives over PostgREST as a STRING, not a number, because
 * a JS float cannot hold every numeric value exactly. Money must therefore be
 * converted deliberately — `price * qty` on a string silently gives NaN or
 * string concatenation, and you find out from a customer.
 */
export function num(
  value: number | string | null | undefined,
  fallback = 0
): number {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

export function formatRupees(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatQty(qty: number, unit: "kg" | "piece"): string {
  if (unit === "piece") return `${qty} pc`;
  return qty < 1 ? `${Math.round(qty * 1000)} g` : `${qty} kg`;
}

/**
 * How a basket line reads.
 *
 * Loose goods are a weight ("1.5 kg"). Packed goods are a COUNT of packs
 * ("2 × 500 g") — writing "2 kg" for two 1 kg bags of atta is technically
 * true and completely confusing at the door when the delivery is checked.
 */
export function formatLineQty(
  qty: number,
  unit: "kg" | "piece",
  packLabelText: string | null
): string {
  if (!packLabelText) return formatQty(qty, unit);
  return qty === 1 ? packLabelText : `${qty} × ${packLabelText}`;
}
