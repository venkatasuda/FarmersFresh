"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PaymentResult =
  | { ok: true; outstanding: number }
  | { ok: false; message: string };

export async function collectPayment(
  customerId: string,
  amount: number,
  method: string,
  note: string
): Promise<PaymentResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Enter an amount greater than zero." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_account_payment", {
    p_customer_id: customerId,
    p_amount: amount,
    p_method: method,
    p_note: note || null,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/credit");
  revalidatePath(`/dashboard/credit/${customerId}`);
  return { ok: true, outstanding: Number(data) };
}
