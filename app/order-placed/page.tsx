import Link from "next/link";
import { ShopShell } from "@/app/(shop)/shop-shell";
import { formatRupees } from "@/lib/shop";

export const metadata = { title: "Order placed · Farmers Fresh" };

/**
 * Confirmation.
 *
 * The order number comes from the checkout redirect rather than a database
 * read, and that is deliberate: `anon` has no SELECT policy on `orders`. If
 * this page could look an order up, so could a stranger changing the number
 * in the URL — and every customer's name, phone and address would be exposed.
 */
export default async function OrderPlacedPage({
  searchParams,
}: {
  searchParams: Promise<{ number?: string; total?: string }>;
}) {
  const { number, total } = await searchParams;
  const amount = total ? Number(total) : null;

  return (
    <ShopShell>
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <svg viewBox="0 0 24 24" fill="none" className="size-7" aria-hidden>
            <path
              d="m5 13 4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">
          Order placed
        </h1>

        {number ? (
          <p className="mt-2 text-sm text-ink-soft">
            Your order number is{" "}
            <span className="font-semibold text-ink">{number}</span>
          </p>
        ) : null}

        {amount !== null && Number.isFinite(amount) ? (
          <p className="mt-4 text-2xl font-semibold text-ink">
            {formatRupees(amount)}
          </p>
        ) : null}

        <p className="mt-4 text-sm text-ink-soft">
          We&apos;ll call you shortly to confirm the cut and the delivery time.
          Please keep cash or UPI ready for the delivery.
        </p>

        <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
          Write this number down — you&apos;ll need it if you call us about the
          order.
        </p>

        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Continue shopping
        </Link>
      </div>
    </ShopShell>
  );
}
