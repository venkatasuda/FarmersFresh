"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Makes the order queue live. Subscribes to changes on `orders` via Supabase
 * Realtime; a new order or a status change refreshes the server-rendered list
 * on the spot — no reload, no polling.
 *
 * Security is not this component's job: Realtime enforces the same RLS as a
 * query, so the browser only ever receives changes for orders this staff
 * member could already see (their org). Nothing here widens access.
 *
 * A new order also rings a short chime and shows a banner, so an order can't
 * quietly pile up while the counter is busy.
 */
export function RealtimeOrders() {
  const router = useRouter();
  const [newCount, setNewCount] = useState(0);
  const [connected, setConnected] = useState(false);
  // Refresh is debounced — a burst of changes shouldn't refetch many times.
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createClient();

    function scheduleRefresh() {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => router.refresh(), 400);
    }

    // A real, actionable order = one the shop should start on. That's a COD
    // order the moment it's inserted, or an online order the moment it's paid
    // (status flips pending_payment → placed). We must NOT chime when an online
    // order is merely created and still awaiting payment.
    const isHeld = (row: Record<string, unknown> | null) =>
      !!row &&
      (row.payment_method === "upi" || row.payment_method === "card") &&
      row.is_paid !== true;

    function announce() {
      setNewCount((c) => c + 1);
      chime();
      scheduleRefresh();
    }

    const channel = supabase
      .channel("orders-board")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (isHeld(row)) {
            scheduleRefresh();
            return;
          }
          announce();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const prev = payload.old as Record<string, unknown>;
          // Online order just got paid: it becomes a new order to work on.
          if (
            prev?.status === "pending_payment" &&
            row?.status === "placed"
          ) {
            announce();
            return;
          }
          scheduleRefresh();
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  function clearAndRefresh() {
    setNewCount(0);
    router.refresh();
  }

  return (
    <>
      {/* Tiny live indicator, so staff know the board is watching. */}
      <span
        className="inline-flex items-center gap-1.5 text-xs text-ink-soft"
        title={connected ? "Live — new orders appear automatically" : "Connecting…"}
      >
        <span
          className={`size-2 rounded-full ${
            connected ? "animate-pulse bg-brand-500" : "bg-zinc-300"
          }`}
        />
        {connected ? "Live" : "Connecting…"}
      </span>

      {newCount > 0 ? (
        <button
          type="button"
          onClick={clearAndRefresh}
          className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-xs items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-medium text-white shadow-lg"
        >
          <span className="size-2 animate-pulse rounded-full bg-white" />
          {newCount} new {newCount === 1 ? "order" : "orders"} — tap to view
        </button>
      ) : null}
    </>
  );
}

/**
 * A short two-tone chime via the Web Audio API — no sound file to ship, and it
 * works offline. Wrapped so a browser that blocks audio (autoplay policy)
 * simply stays silent instead of throwing.
 */
function chime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [880, 1174];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      osc.start(t);
      osc.stop(t + 0.16);
    });
    window.setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // Audio blocked or unavailable — stay silent.
  }
}
