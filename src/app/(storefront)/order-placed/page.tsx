import { OrderPlacedPageView } from "@/features/checkout/confirmation-view";
import { getPersonalizedProducts } from "@/server/catalogue/storefront";
import { getOrderReceipt } from "@/server/orders/queries";

export const metadata = { title: "Order placed · Farmers Fresh" };

// Order numbers look like FF-260726-0019. We only echo the URL number back if it
// matches, so a forged/injected value can never render as-is.
const ORDER_RE = /^FF-\d{6}-\d{4}$/i;

type Receipt = {
  order_number: string;
  status: string;
  is_paid: boolean;
  payment_method: string;
  total: number;
  contact_name: string;
  address_line: string;
  city: string | null;
  pincode: string | null;
  items: { name: string; quantity: number; unit: string; line_total: number }[];
};

/**
 * Post-checkout confirmation. The total and paid state are NEVER taken from the
 * URL — they're read back from the order via get_order_receipt (which only
 * returns the row to its owner: the signed-in customer, or a matching phone).
 * If we can't verify ownership (a guest with no session, or a bad number) we
 * show a minimal confirmation with no money, and point them to /track.
 */
export default async function OrderPlacedPage({
  searchParams,
}: {
  searchParams: Promise<{ number?: string }>;
}) {
  const { number } = await searchParams;
  const clean = (number ?? "").trim();
  const safeNumber = ORDER_RE.test(clean) ? clean.toUpperCase() : null;

  let receipt: Receipt | null = null;
  if (safeNumber) {
    const data = await getOrderReceipt(safeNumber);
    if (data) receipt = data as Receipt;
  }

  // A just-placed COD order can still take a few more items for 15 minutes
  // (the add_to_order RPC enforces the window, ownership and stock).
  let suggestions: { id: string; name: string; price: number; loose: boolean }[] = [];
  if (receipt && receipt.payment_method === "cod") {
    const products = await getPersonalizedProducts(6);
    suggestions = products
      .filter((p) => p.inStock && p.salePrice != null)
      .slice(0, 4)
      .map((p) => ({ id: p.id, name: p.name, price: p.salePrice, loose: p.packSize === null }));
  }

  return <OrderPlacedPageView receipt={receipt} safeNumber={safeNumber} suggestions={suggestions} />;
}
