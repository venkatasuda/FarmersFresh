import { getReceipt } from "./actions";
import { ReceiptGate } from "./receipt-gate";
import { ReceiptView } from "./receipt-view";

export const metadata = { title: "Receipt · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ number?: string }>;
}) {
  const { number } = await searchParams;

  // Try to resolve it as the logged-in owner (no phone needed). If that fails —
  // a guest, or someone else's order — fall through to the phone-gated form.
  const receipt = number ? await getReceipt(number) : null;

  if (receipt) return <ReceiptView receipt={receipt} />;
  return <ReceiptGate initialNumber={number} />;
}
