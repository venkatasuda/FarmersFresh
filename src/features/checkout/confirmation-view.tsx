import { AddMore } from "@/features/checkout/add-more";
import { Confetti } from "@/features/checkout/confetti";
import { formatRupees } from "@/lib/format";
import Link from "next/link";

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

type OrderPlacedPageViewProps = {
  receipt: Receipt | null;
  safeNumber: string | null;
  suggestions: { id: string; name: string; price: number; loose: boolean; }[];
};

export function OrderPlacedPageView({ receipt, safeNumber, suggestions }: OrderPlacedPageViewProps) {
  return (
    <>
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
    </>
  );
}
