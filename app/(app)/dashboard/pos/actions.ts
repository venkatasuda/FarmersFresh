"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sanitizeError, toAmount, toQuantity } from "@/lib/guard";

export type SaleLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export type SaleResult =
  | { ok: true; saleId: string; total: number; change: number }
  | { ok: false; message: string };

export type LoyaltyMember =
  | { found: true; userId: string; name: string; points: number }
  | { found: false };

/** Look up a scanned/typed loyalty card (the customer's code) at the till. */
export async function lookupLoyalty(code: string): Promise<LoyaltyMember> {
  const clean = code.trim();
  if (!clean) return { found: false };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_loyalty_lookup", {
    p_code: clean,
  });
  if (error || !data) return { found: false };

  const d = data as {
    found?: boolean;
    user_id?: string;
    name?: string;
    points?: number;
  };
  if (!d.found || !d.user_id) return { found: false };
  return {
    found: true,
    userId: d.user_id,
    name: d.name ?? "Member",
    points: Number(d.points ?? 0),
  };
}

/**
 * Records a counter sale. The heavy lifting — stock drawdown, payment,
 * event, credit-balance rules — all happens in record_sale in the database,
 * in one transaction. This action just marshals the input.
 */
export async function recordSale(input: {
  locationId: string;
  customerId: string | null;
  lines: SaleLine[];
  method: string;
  amountPaid: number;
  note: string;
  loyaltyUser?: string | null;
  pointsRedeem?: number;
}): Promise<SaleResult> {
  if (input.lines.length === 0) {
    return { ok: false, message: "Add something to the sale first." };
  }

  // Coerce every number before it leaves the app. A NaN quantity or a hacked
  // negative price would otherwise reach record_sale as junk.
  const lines: { product_id: string; quantity: number; unit_price: number }[] =
    [];
  for (const l of input.lines) {
    const quantity = toQuantity(l.quantity);
    // Price may legitimately be 0 (a free item), so allow 0 but reject junk.
    const price =
      Number.isFinite(l.unitPrice) && l.unitPrice >= 0 && l.unitPrice <= 1_000_000
        ? Math.round(l.unitPrice * 100) / 100
        : null;
    if (quantity === null || price === null || !l.productId) {
      return { ok: false, message: "Check the quantity and price on each line." };
    }
    lines.push({ product_id: l.productId, quantity, unit_price: price });
  }

  const amountPaid =
    input.amountPaid > 0 ? (toAmount(input.amountPaid) ?? 0) : 0;

  const supabase = await createClient();

  // Points to redeem: coerce to a non-negative whole number, only when a member
  // is attached. The database re-caps it to the balance and the sale total.
  const pointsRedeem =
    input.loyaltyUser && Number.isFinite(input.pointsRedeem)
      ? Math.max(0, Math.floor(input.pointsRedeem as number))
      : 0;

  const { data, error } = await supabase.rpc("record_sale", {
    p_location: input.locationId,
    p_customer_id: input.customerId,
    p_lines: lines,
    p_method: input.method,
    p_amount_paid: amountPaid,
    p_note: input.note || null,
    p_loyalty_user: input.loyaltyUser ?? null,
    p_points_redeem: pointsRedeem,
  });

  if (error) return { ok: false, message: sanitizeError(error.message) };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, message: "The sale didn't record. Try again." };

  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard/stock");
  revalidatePath("/");

  return {
    ok: true,
    saleId: String(row.sale_id),
    total: Number(row.total),
    change: Number(row.change),
  };
}

/** Find or create a customer by phone, for credit sales. */
export async function findOrCreateCustomer(
  locationId: string,
  name: string,
  phone: string
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("upsert_customer", {
    p_location: locationId,
    p_name: name,
    p_phone: phone,
  });

  if (error) return { ok: false, message: sanitizeError(error.message) };
  return { ok: true, id: String(data) };
}
