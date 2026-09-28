"use client";

import { useState, useTransition } from "react";
import {
  cancelSubscription,
  setSubscriptionActive,
  type MySubscription,
} from "./subscription-actions";

const EVERY: Record<MySubscription["frequency"], string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
};

export function SubscriptionList({ initial }: { initial: MySubscription[] }) {
  const [subs, setSubs] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (subs.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-ink-soft">
        No subscriptions. Set one up from any product page.
      </p>
    );
  }

  function toggle(s: MySubscription) {
    setBusy(s.id);
    startTransition(async () => {
      const r = await setSubscriptionActive(s.id, !s.is_active);
      if (r.ok) {
        setSubs((prev) =>
          prev.map((x) => (x.id === s.id ? { ...x, is_active: !x.is_active } : x))
        );
      }
      setBusy(null);
    });
  }

  function remove(s: MySubscription) {
    setBusy(s.id);
    startTransition(async () => {
      const r = await cancelSubscription(s.id);
      if (r.ok) setSubs((prev) => prev.filter((x) => x.id !== s.id));
      setBusy(null);
    });
  }

  return (
    <ul className="space-y-3">
      {subs.map((s) => (
        <li
          key={s.id}
          className="rounded-2xl border border-line bg-surface p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-ink">{s.product_name}</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                Qty {s.quantity} · every {EVERY[s.frequency]}
              </p>
              {s.is_active && s.next_run ? (
                <p className="mt-0.5 text-xs text-ink-soft">
                  Next delivery{" "}
                  {new Date(s.next_run + "T00:00:00").toLocaleDateString(
                    "en-IN",
                    { dateStyle: "medium" }
                  )}
                </p>
              ) : null}
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                s.is_active
                  ? "bg-brand-100 text-brand-800"
                  : "bg-line/60 text-ink-soft"
              }`}
            >
              {s.is_active ? "Active" : "Paused"}
            </span>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy === s.id}
              onClick={() => toggle(s)}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
            >
              {s.is_active ? "Pause" : "Resume"}
            </button>
            <button
              type="button"
              disabled={busy === s.id}
              onClick={() => remove(s)}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-red-300 hover:text-red-700 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
