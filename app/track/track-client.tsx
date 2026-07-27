"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { trackOrder, type TrackedOrder } from "./actions";
import { RiderMap } from "./rider-map";
import { RateDelivery } from "./rate-delivery";
import { formatQty, formatRupees } from "@/lib/format";

function etaText(t: NonNullable<TrackedOrder["tracking"]>): string | null {
  if (t.etaMinutes == null || !t.etaSetAt) return null;
  const elapsedMin = (Date.now() - new Date(t.etaSetAt).getTime()) / 60000;
  const remaining = Math.max(Math.round(t.etaMinutes - elapsedMin), 1);
  return `Arriving in about ${remaining} min`;
}

const STEPS: { key: TrackedOrder["status"]; label: string }[] = [
  { key: "placed", label: "Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "packed", label: "Packed" },
  { key: "out_for_delivery", label: "On the way" },
  { key: "delivered", label: "Delivered" },
];

export function TrackClient({ initialNumber }: { initialNumber?: string }) {
  const [orderNumber, setOrderNumber] = useState(initialNumber ?? "");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Keep the last successful credentials so we can quietly re-poll.
  const creds = useRef<{ number: string; phone: string } | null>(null);

  function submit() {
    setError(null);
    setOrder(null);
    startTransition(async () => {
      const r = await trackOrder(orderNumber, phone);
      if (!r.ok) {
        setError(r.message);
        creds.current = null;
        return;
      }
      setOrder(r.order);
      creds.current = { number: orderNumber, phone };
    });
  }

  const cancelled = order?.status === "cancelled";
  const finished = order?.status === "delivered" || cancelled;

  // Live updates without an account: the customer can't subscribe (anon has no
  // read on orders), so poll the secure track_order() every 20s while an open
  // order is on screen. Stops once the order is delivered or cancelled, and
  // pauses when the tab is hidden — no wasted requests.
  useEffect(() => {
    if (!order || finished || !creds.current) return;

    // Poll faster while it's on the way so the rider marker moves smoothly.
    const every = order.status === "out_for_delivery" ? 10000 : 20000;
    const id = window.setInterval(async () => {
      if (document.hidden || !creds.current) return;
      const r = await trackOrder(creds.current.number, creds.current.phone);
      if (r.ok) setOrder(r.order);
    }, every);

    return () => window.clearInterval(id);
  }, [order, finished]);
  const currentIndex = order
    ? STEPS.findIndex((s) => s.key === order.status)
    : -1;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Track your order
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Enter your order number and the phone number you ordered with.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-5 space-y-3 rounded-2xl border border-line bg-surface p-5"
      >
        <label className="block">
          <span className="text-sm font-medium text-ink">Order number</span>
          <input
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="FF-260726-0001"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Phone number</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="numeric"
            placeholder="10-digit mobile"
            className={inputClass}
          />
        </label>

        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Checking…" : "Track order"}
        </button>
      </form>

      {order ? (
        <div className="mt-6 space-y-5">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-ink">{order.orderNumber}</p>
                <p className="text-sm text-ink-soft">
                  {new Date(order.placedAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <p className="text-lg font-semibold text-ink tabular-nums">
                {formatRupees(order.total)}
              </p>
            </div>

            <a
              href={`/receipt?number=${encodeURIComponent(order.orderNumber)}`}
              className="mt-2 inline-block text-sm text-brand-700 hover:underline"
            >
              View receipt →
            </a>

            {order.status === "delivered" ? (
              <RateDelivery orderNumber={order.orderNumber} phone={phone} />
            ) : null}

            {order.tracking ? (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-brand-700">
                    <span className="size-2 animate-pulse rounded-full bg-brand-500" />
                    Your rider is on the way
                  </span>
                  {etaText(order.tracking) ? (
                    <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-800">
                      {etaText(order.tracking)}
                    </span>
                  ) : null}
                </div>
                <RiderMap lat={order.tracking.lat} lng={order.tracking.lng} />
                <p className="mt-1 text-center text-xs text-ink-soft">
                  Live location, updated as they move.
                </p>
              </div>
            ) : null}

            {cancelled ? (
              <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                This order was cancelled
                {order.cancelledReason ? ` — ${order.cancelledReason}` : ""}.
              </div>
            ) : (
              <>
                {!finished ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-brand-700">
                    <span className="size-2 animate-pulse rounded-full bg-brand-500" />
                    Live — this updates on its own as your order moves
                  </p>
                ) : null}
                <ol className="mt-4 space-y-0">
                {STEPS.map((step, i) => {
                  const reached = i <= currentIndex;
                  const isLast = i === STEPS.length - 1;
                  return (
                    <li key={step.key} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`flex size-6 items-center justify-center rounded-full text-xs ${
                            reached
                              ? "bg-brand-600 text-white"
                              : "bg-brand-100 text-brand-300"
                          }`}
                        >
                          {reached ? "✓" : i + 1}
                        </span>
                        {!isLast ? (
                          <span
                            className={`w-0.5 flex-1 ${
                              i < currentIndex ? "bg-brand-500" : "bg-brand-100"
                            }`}
                            style={{ minHeight: "1.5rem" }}
                          />
                        ) : null}
                      </div>
                      <span
                        className={`pb-4 text-sm ${
                          reached ? "font-medium text-ink" : "text-ink-soft"
                        }`}
                      >
                        {step.label}
                        {i === currentIndex ? (
                          <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800">
                            now
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
                </ol>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-sm font-medium text-ink">Your items</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {order.items.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="text-ink">
                    {it.slug ? (
                      <Link
                        href={`/shop/${it.slug}`}
                        className="hover:text-brand-700"
                      >
                        {it.name}
                      </Link>
                    ) : (
                      it.name
                    )}
                    <span className="ml-2 text-xs text-ink-soft">
                      {formatQty(it.quantity, it.unit === "piece" ? "piece" : "kg")}
                    </span>
                  </span>
                  <span className="tabular-nums text-ink-soft">
                    {formatRupees(it.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-line pt-3 text-xs text-ink-soft">
              Tap an item to order it again.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-500";
