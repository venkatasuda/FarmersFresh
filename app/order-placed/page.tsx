import Link from "next/link";
import { ShopShell } from "@/app/(shop)/shop-shell";
import { createClient } from "@/lib/supabase/server";
import { formatRupees } from "@/lib/format";
import { getPersonalizedProducts } from "@/lib/shop";
import { Confetti } from "./confetti";
import { AddMore } from "./add-more";

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
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_order_receipt", { p_number: safeNumber });
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

  return (
    <ShopShell>
      <Confetti />
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <svg viewBox="0 0 24 24" fill="none" className="size-7" aria-hidden>
            <path
              d="M20 6 9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">
          Thank you — your order is placed
        </h1>

        {receipt ? (
          <>
            <p className="mt-2 text-sm text-ink-soft">
              Order <span className="font-medium text-ink">{receipt.order_number}</span>
              {receipt.is_paid ? (
                <span className="ml-2 rounded-md bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">
                  Paid
                </span>
              ) : receipt.payment_method === "cod" ? (
                <span className="ml-2 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                  Cash on delivery
                </span>
              ) : null}
            </p>

            <div className="mt-5 rounded-2xl border border-line bg-surface p-5 text-left">
              <ul className="space-y-2 text-sm">
                {receipt.items.map((i, idx) => (
                  <li key={idx} className="flex justify-between gap-3">
                    <span className="text-ink-soft">
                      {i.name}{" "}
                      <span className="text-xs">
                        ({i.quantity}
                        {i.unit === "kg" ? "kg" : "×"})
                      </span>
                    </span>
                    <span className="tabular-nums text-ink">{formatRupees(i.line_total)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between border-t border-line pt-3">
                <span className="font-medium text-ink">Total</span>
                <span className="text-lg font-semibold text-ink tabular-nums">
                  {formatRupees(receipt.total)}
                </span>
              </div>
              <p className="mt-3 text-xs text-ink-soft">
                Delivering to {receipt.contact_name}, {receipt.address_line}
                {receipt.city ? `, ${receipt.city}` : ""}
                {receipt.pincode ? ` - ${receipt.pincode}` : ""}
              </p>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">
            {safeNumber ? (
              <>
                Order <span className="font-medium text-ink">{safeNumber}</span> has been
                received. We&apos;ll call you to confirm. Enter your order number and phone on
                the tracking page to see the full details.
              </>
            ) : (
              <>Your order has been received. We&apos;ll call you shortly to confirm.</>
            )}
          </p>
        )}

        {receipt && receipt.payment_method === "cod" ? (
          <AddMore orderNumber={receipt.order_number} products={suggestions} />
        ) : null}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={safeNumber ? `/track?number=${encodeURIComponent(safeNumber)}` : "/track"}
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Track your order
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink hover:border-brand-300 hover:bg-brand-50"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </ShopShell>
  );
}
