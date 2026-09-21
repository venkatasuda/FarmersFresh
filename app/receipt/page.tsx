import { createClient } from "@/lib/supabase/server";
import { mapReceipt } from "./receipt-types";
import { ReceiptView } from "./receipt-view";
import { ReceiptGate } from "./receipt-gate";

export const metadata = { title: "Receipt · Farmers Fresh" };

// Order numbers look like FF-260726-0019. Only a well-formed number is queried,
// so a forged/injected value can't be used as-is.
const ORDER_RE = /^FF-\d{6}-\d{4}$/i;

/**
 * Printable receipt page — the target of the "View & print receipt" link in
 * confirmation emails. A signed-in owner sees the receipt immediately
 * (get_order_receipt matches on auth.uid()); anyone else confirms the order's
 * phone number in the gate and is verified server-side. Amounts always come from
 * the RPC, never from the URL, and the phone is never placed in the URL.
 */
export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ number?: string }>;
}) {
  const { number } = await searchParams;
  const clean = (number ?? "").trim();
  const safeNumber = ORDER_RE.test(clean) ? clean.toUpperCase() : "";

  if (safeNumber) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_order_receipt", { p_number: safeNumber });
    if (data) return <ReceiptView receipt={mapReceipt(data)} />;
  }

  return <ReceiptGate initialNumber={safeNumber || undefined} />;
}
