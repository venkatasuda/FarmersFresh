"use client";

import { useState, useTransition } from "react";
import { advanceOrder, cancelOrder } from "./actions";
import { formatQty, formatRupees } from "@/lib/format";
import {
  SLOT_LABELS,
  STATUS_LABELS,
  nextStatus,
  type StaffOrder,
} from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  placed: "bg-brand-600 text-white",
  confirmed: "bg-brand-100 text-brand-800",
  packed: "bg-amber-100 text-amber-800",
  out_for_delivery: "bg-blue-100 text-blue-800",
  delivered: "bg-zinc-100 text-ink-soft",
  cancelled: "bg-red-100 text-red-700",
};

export function OrderCard({ order }: { order: StaffOrder }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const next = nextStatus(order.status);
  const finished = order.status === "delivered" || order.status === "cancelled";

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message ?? "Something went wrong.");
    });
  }

  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-ink">{order.orderNumber}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_STYLES[order.status] ?? "bg-zinc-100 text-ink-soft"
              }`}
            >
              {STATUS_LABELS[order.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {new Date(order.placedAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {order.deliverySlot
              ? ` · ${SLOT_LABELS[order.deliverySlot] ?? order.deliverySlot}`
              : null}
          </p>
        </div>

        <p className="text-lg font-semibold text-ink tabular-nums">
          {formatRupees(order.total)}
        </p>
      </header>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="text-xs font-medium tracking-wide text-ink-soft uppercase">
            Deliver to
          </h4>
          <p className="mt-1 font-medium text-ink">{order.contactName}</p>
          {/* tel: link so staff can dial straight from the phone at the counter */}
          <a
            href={`tel:${order.contactPhone}`}
            className="text-sm text-brand-700 hover:underline"
          >
            {order.contactPhone}
          </a>
          <p className="mt-1 text-sm text-ink-soft">
            {order.addressLine}
            {order.city ? `, ${order.city}` : ""}
            {order.pincode ? ` — ${order.pincode}` : ""}
          </p>
          {order.landmark ? (
            <p className="text-sm text-ink-soft">Near {order.landmark}</p>
          ) : null}
          {order.notes ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm text-amber-900">
              {order.notes}
            </p>
          ) : null}
        </div>

        <div>
          <h4 className="text-xs font-medium tracking-wide text-ink-soft uppercase">
            Cut list
          </h4>
          <ul className="mt-1 space-y-1 text-sm">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span className="text-ink">
                  {i.productName}{" "}
                  <span className="text-ink-soft">
                    {formatQty(i.quantity, i.unit === "piece" ? "piece" : "kg")}
                  </span>
                </span>
                <span className="tabular-nums text-ink-soft">
                  {formatRupees(i.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-line pt-2 text-sm text-ink-soft">
            Subtotal {formatRupees(order.subtotal)} · Delivery{" "}
            {order.deliveryFee === 0 ? "free" : formatRupees(order.deliveryFee)}
          </p>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {!finished ? (
        <footer className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {next ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => advanceOrder(order.id, next))}
              className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Mark {STATUS_LABELS[next].toLowerCase()}
            </button>
          ) : null}

          {confirmCancel ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-soft">
                Cancel and put the stock back?
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => cancelOrder(order.id, "Cancelled by staff"))
                }
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                Yes, cancel
              </button>
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                className="rounded-lg border border-line px-3 py-2 text-sm text-ink-soft"
              >
                No
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="rounded-lg border border-line px-3.5 py-2 text-sm text-ink-soft hover:border-red-300 hover:text-red-600"
            >
              Cancel order
            </button>
          )}
        </footer>
      ) : null}
    </article>
  );
}
