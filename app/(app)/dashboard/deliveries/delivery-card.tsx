"use client";

import { useState, useTransition } from "react";
import { claimDelivery, setDeliveryStatus } from "./actions";
import { formatRupees } from "@/lib/format";
import { SLOT_LABELS, type Delivery } from "@/lib/types";

export function DeliveryCard({
  delivery,
  myId,
}: {
  delivery: Delivery;
  myId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const mine = delivery.assignedTo && delivery.assignedTo === myId;
  const takenByOther = delivery.assignedTo && delivery.assignedTo !== myId;

  // A maps link from the address — opens Google Maps for navigation.
  const mapsQuery = encodeURIComponent(
    [delivery.addressLine, delivery.landmark, delivery.city, delivery.pincode]
      .filter(Boolean)
      .join(", ")
  );

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message ?? "Something went wrong.");
    });
  }

  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{delivery.orderNumber}</p>
          <p className="text-xs text-ink-soft">
            {delivery.deliverySlot
              ? SLOT_LABELS[delivery.deliverySlot] ?? delivery.deliverySlot
              : "No slot"}
            {" · "}
            {delivery.status === "out_for_delivery"
              ? "On the way"
              : delivery.status === "packed"
                ? "Packed"
                : "Confirmed"}
          </p>
        </div>
        <p className="text-lg font-semibold text-ink tabular-nums">
          {formatRupees(delivery.total)}
        </p>
      </header>

      <div className="mt-3 space-y-1">
        <p className="font-medium text-ink">{delivery.contactName}</p>
        <p className="text-sm text-ink-soft">
          {delivery.addressLine}
          {delivery.landmark ? `, near ${delivery.landmark}` : ""}
          {delivery.city ? `, ${delivery.city}` : ""}
          {delivery.pincode ? ` — ${delivery.pincode}` : ""}
        </p>
      </div>

      {takenByOther ? (
        <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs text-ink-soft">
          Being delivered by {delivery.assignedName ?? "someone"}
        </p>
      ) : null}

      {/* Rider quick actions: call and navigate, always one tap away. */}
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={`tel:${delivery.contactPhone}`}
          className="flex-1 rounded-lg border border-line px-3 py-2 text-center text-sm font-medium text-ink hover:border-brand-300 hover:text-brand-700"
        >
          Call
        </a>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-lg border border-line px-3 py-2 text-center text-sm font-medium text-ink hover:border-brand-300 hover:text-brand-700"
        >
          Navigate
        </a>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
        {!delivery.assignedTo ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => claimDelivery(delivery.id, true))}
            className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Take this delivery
          </button>
        ) : null}

        {mine ? (
          <>
            {delivery.status !== "out_for_delivery" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => setDeliveryStatus(delivery.id, "out_for_delivery"))
                }
                className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                Start delivery
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setDeliveryStatus(delivery.id, "delivered"))}
                className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                Mark delivered
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => claimDelivery(delivery.id, false))}
              className="rounded-lg border border-line px-3.5 py-2 text-sm text-ink-soft hover:text-ink"
            >
              Hand off
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}
