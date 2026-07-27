"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  claimDelivery,
  setDeliveryStatus,
  updateRiderLocation,
} from "./actions";
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

  // A maps link — use the exact GPS pin when the customer dropped one,
  // otherwise fall back to the typed address.
  const mapsQuery =
    delivery.lat != null && delivery.lng != null
      ? `${delivery.lat},${delivery.lng}`
      : encodeURIComponent(
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

      {mine && delivery.status === "out_for_delivery" ? (
        <LocationShare orderId={delivery.id} />
      ) : null}
    </article>
  );
}

/**
 * Rider's "share live location" control. When on, it watches the device GPS and
 * pushes each position to the order so the customer sees a moving marker. The
 * ETA buttons tag the customer's map with an honest, rider-set arrival time.
 * Stops on unmount or when toggled off — nothing runs in the background.
 */
function LocationShare({ orderId }: { orderId: string }) {
  const [sharing, setSharing] = useState(false);
  const [eta, setEta] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const lastPos = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    return () => {
      if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current);
    };
  }, []);

  function start() {
    if (!("geolocation" in navigator)) {
      setNote("This device can't share location.");
      return;
    }
    setNote(null);
    setSharing(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        lastPos.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        void updateRiderLocation(
          orderId,
          pos.coords.latitude,
          pos.coords.longitude,
          eta ?? undefined
        );
      },
      () => setNote("Couldn't get your location. Allow location access."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }

  function stop() {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setSharing(false);
  }

  function setEtaMinutes(m: number) {
    setEta(m);
    const p = lastPos.current;
    if (p) void updateRiderLocation(orderId, p.lat, p.lng, m);
    else setNote("Turn on location sharing first.");
  }

  return (
    <div className="mt-3 rounded-lg bg-brand-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-brand-900">
          Live location {sharing ? "· on" : ""}
        </span>
        <button
          type="button"
          onClick={sharing ? stop : start}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            sharing
              ? "border border-brand-300 text-brand-700"
              : "bg-brand-600 text-white hover:bg-brand-700"
          }`}
        >
          {sharing ? "Stop sharing" : "Share my location"}
        </button>
      </div>
      {sharing ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-brand-700">ETA:</span>
          {[10, 20, 30].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setEtaMinutes(m)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                eta === m ? "bg-brand-600 text-white" : "border border-brand-300 text-brand-700"
              }`}
            >
              {m} min
            </button>
          ))}
        </div>
      ) : null}
      {note ? <p className="mt-1.5 text-xs text-red-700">{note}</p> : null}
    </div>
  );
}
