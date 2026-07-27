import { formatRupees } from "@/lib/format";
import type { Savings } from "./wallet-actions";

/**
 * "You've saved ₹X with us" — the proof point for our fair-pricing promise.
 * Adds up genuine savings only: discounts actually given plus the delivery
 * fees waived. No inflated-MRP maths. Presentational; the page fetches the
 * numbers and the store's standard delivery fee.
 */
export function SavingsCard({
  savings,
  deliveryFee,
}: {
  savings: Savings;
  deliveryFee: number;
}) {
  if (savings.orderCount <= 0) return null;

  const deliverySaved = savings.freeDeliveries * Math.max(deliveryFee, 0);
  const totalSaved = savings.totalDiscount + deliverySaved;

  return (
    <div className="mt-6 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-brand-100 p-5">
      <p className="text-sm font-medium text-brand-800">
        You&apos;ve saved with Farmers Fresh
      </p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-brand-900 tabular-nums">
        {formatRupees(totalSaved)}
      </p>
      <p className="mt-2 text-xs text-brand-700">
        {savings.totalDiscount > 0
          ? `${formatRupees(savings.totalDiscount)} in real discounts`
          : "Fair prices on every order"}
        {savings.freeDeliveries > 0
          ? ` · ${savings.freeDeliveries} free ${
              savings.freeDeliveries === 1 ? "delivery" : "deliveries"
            }`
          : ""}
        {" · no hidden fees, no fake MRP."}
      </p>
    </div>
  );
}
