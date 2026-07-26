"use client";

import Link from "next/link";
import type { Receipt } from "./actions";
import { PrintButton } from "./print-button";
import { formatRupees } from "@/lib/format";

const PAYMENT_LABELS: Record<string, string> = {
  cod: "Cash on delivery",
  upi: "UPI",
  card: "Card",
  upi_on_delivery: "UPI on delivery",
};

/**
 * The printable receipt itself. A plain client component so it can render both
 * from the server (logged-in owner) and from the guest phone-gate, and so the
 * "Print / Save as PDF" button works. Styled to print cleanly (print:* hides
 * the chrome; the card prints borderless).
 */
export function ReceiptView({ receipt }: { receipt: Receipt }) {
  const paymentLabel = PAYMENT_LABELS[receipt.paymentMethod] ?? "Cash on delivery";
  const online =
    receipt.paymentMethod === "upi" || receipt.paymentMethod === "card";
  const placed = receipt.placedAt
    ? new Date(receipt.placedAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  return (
    <main className="mx-auto max-w-lg px-4 py-8 print:py-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/" className="text-sm text-ink-soft hover:text-brand-700">
          ← Shop
        </Link>
        <PrintButton />
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-line pb-4">
          <div>
            <p className="text-lg font-semibold tracking-tight text-brand-700">
              Farmers Fresh
            </p>
            <p className="text-xs text-ink-soft">Fresh from our farms</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-ink">Receipt</p>
            <p className="text-xs text-ink-soft">{receipt.orderNumber}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-line py-4 text-sm">
          <div>
            <p className="text-xs text-ink-soft">Billed to</p>
            <p className="font-medium text-ink">{receipt.contactName}</p>
            <p className="text-ink-soft">{receipt.contactPhone}</p>
            <p className="mt-1 text-xs text-ink-soft">
              {receipt.addressLine}
              {receipt.city ? `, ${receipt.city}` : ""}
              {receipt.pincode ? ` — ${receipt.pincode}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-soft">Placed</p>
            <p className="text-ink">{placed}</p>
            <p className="mt-1 text-xs text-ink-soft">Payment</p>
            <p className="text-ink">
              {paymentLabel}
              {online ? (
                <span
                  className={`ml-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                    receipt.isPaid
                      ? "bg-brand-100 text-brand-800"
                      : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {receipt.isPaid ? "Paid" : "Unpaid"}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <table className="w-full border-b border-line py-2 text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-soft">
              <th className="py-2 font-normal">Item</th>
              <th className="py-2 text-right font-normal">Qty</th>
              <th className="py-2 text-right font-normal">Rate</th>
              <th className="py-2 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((it, i) => (
              <tr key={i} className="border-t border-line/60">
                <td className="py-2 pr-2 text-ink">{it.name}</td>
                <td className="py-2 text-right tabular-nums text-ink-soft">
                  {it.quantity}
                  {it.unit === "kg" ? " kg" : ""}
                </td>
                <td className="py-2 text-right tabular-nums text-ink-soft">
                  {formatRupees(it.unit_price)}
                </td>
                <td className="py-2 text-right tabular-nums text-ink">
                  {formatRupees(it.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-1.5 py-4 text-sm">
          <Row label="Subtotal" value={formatRupees(receipt.subtotal)} />
          {receipt.discount > 0 ? (
            <Row
              label={`Discount${receipt.couponCode ? ` (${receipt.couponCode})` : ""}`}
              value={`−${formatRupees(receipt.discount)}`}
              accent
            />
          ) : null}
          {receipt.pointsRedeemed > 0 ? (
            <Row
              label={`Loyalty points (${Math.floor(receipt.pointsRedeemed)})`}
              value={`−${formatRupees(receipt.pointsRedeemed)}`}
              accent
            />
          ) : null}
          <Row
            label="Delivery"
            value={
              receipt.deliveryFee === 0 ? "Free" : formatRupees(receipt.deliveryFee)
            }
          />
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-base font-semibold text-ink">
            <span>Total</span>
            <span className="tabular-nums">{formatRupees(receipt.total)}</span>
          </div>
        </div>

        <div className="rounded-lg bg-brand-50 px-3 py-2 text-center text-xs text-brand-800">
          {receipt.pointsEarned > 0
            ? `You earned ${Math.floor(receipt.pointsEarned)} loyalty points on this order.`
            : `You'll earn ${receipt.pointsWillEarn} loyalty points when this order is delivered.`}
        </div>

        {receipt.store.gstin || receipt.store.address || receipt.store.supportPhone ? (
          <div className="mt-4 border-t border-line pt-3 text-center text-[11px] text-ink-soft">
            <p className="font-medium text-ink">{receipt.store.name}</p>
            {receipt.store.address ? <p>{receipt.store.address}</p> : null}
            {receipt.store.gstin ? <p>GSTIN: {receipt.store.gstin}</p> : null}
            {receipt.store.supportPhone ? (
              <p>Support: {receipt.store.supportPhone}</p>
            ) : null}
          </div>
        ) : null}

        <p className="mt-4 text-center text-xs text-ink-soft">
          Thank you for shopping with {receipt.store.name}. This is a
          computer-generated receipt.
        </p>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={accent ? "text-brand-700" : "text-ink-soft"}>{label}</span>
      <span
        className={`tabular-nums ${accent ? "font-medium text-brand-700" : "text-ink"}`}
      >
        {value}
      </span>
    </div>
  );
}
