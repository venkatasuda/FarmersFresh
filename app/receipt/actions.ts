"use server";

import { createClient } from "@/lib/supabase/server";
import { mapReceipt, type Receipt } from "./receipt-types";

// Verify ownership by phone (for guests arriving from an email/SMS link with no
// session). get_order_receipt returns null on any mismatch, so we never confirm
// an order exists to someone who can't prove it's theirs. The phone is passed in
// the request body, never in the URL.
export async function getReceipt(
  orderNumber: string,
  phone: string
): Promise<Receipt | null> {
  if (!orderNumber.trim() || !phone.trim()) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_order_receipt", {
    p_number: orderNumber,
    p_phone: phone,
  });
  return data ? mapReceipt(data) : null;
}
