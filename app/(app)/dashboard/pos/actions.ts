"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaleLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export type SaleResult =
  | { ok: true; saleId: string; total: number; change: number }
  | { ok: false; message: string };

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
}): Promise<SaleResult> {
  if (input.lines.length === 0) {
    return { ok: false, message: "Add something to the sale first." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("record_sale", {
    p_location: input.locationId,
    p_customer_id: input.customerId,
    p_lines: input.lines.map((l) => ({
      product_id: l.productId,
      quantity: l.quantity,
      unit_price: l.unitPrice,
    })),
    p_method: input.method,
    p_amount_paid: input.amountPaid,
    p_note: input.note || null,
  });

  if (error) return { ok: false, message: error.message };

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

  if (error) return { ok: false, message: error.message };
  return { ok: true, id: String(data) };
}
