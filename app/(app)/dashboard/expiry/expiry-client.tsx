"use client";

import { useState, useTransition } from "react";
import { formatQty, formatRupees } from "@/lib/format";
import { getExpiring, writeOffBatch, type ExpiringBatch } from "./actions";

const WINDOWS = [3, 7, 14, 30] as const;

export function ExpiryClient({
  initial,
  initialDays,
}: {
  initial: ExpiringBatch[];
  initialDays: number;
}) {
  const [days, setDays] = useState(initialDays);
  const [rows, setRows] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(d: number) {
    setDays(d);
    setError(null);
    startTransition(async () => setRows(await getExpiring(d)));
  }

  function refresh() {
    startTransition(async () => setRows(await getExpiring(days)));
  }

  function writeOff(b: ExpiringBatch) {
    if (!confirm(`Write off ${formatQty(b.remaining, "kg")} of ${b.productName} (batch ${b.batchCode})?`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await writeOffBatch(b.id, "expiry", "");
      if (!r.ok) {
        setError(r.message);
        return;
      }
      refresh();
    });
  }

  const atRisk = rows.reduce((s, b) => s + b.value, 0);
  const expired = rows.filter((b) => b.daysLeft !== null && b.daysLeft < 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Expiry</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Lots nearing or past their date, oldest first. Stock is sold oldest-first
            (FEFO) automatically; use this to clear or write off what won&apos;t sell
            in time.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
          {WINDOWS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => pick(d)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                days === d ? "bg-brand-600 text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs text-ink-soft">Value at risk (next {days} days)</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-amber-700 tabular-nums">
            {formatRupees(atRisk)}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs text-ink-soft">Already expired (on hand)</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-red-600 tabular-nums">
            {expired.length}
          </p>
        </div>
      </div>

      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-ink-soft">
          Nothing expiring in this window — you&apos;re on top of it.
        </p>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-line bg-surface">
          <ul className="divide-y divide-line">
            {rows.map((b) => {
              const expiredRow = b.daysLeft !== null && b.daysLeft < 0;
              const soon = b.daysLeft !== null && b.daysLeft >= 0 && b.daysLeft <= 2;
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {b.productName}
                      <span className="ml-2 text-xs font-normal text-ink-soft">
                        {b.batchCode}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {formatQty(b.remaining, "kg")} left · {formatRupees(b.value)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        expiredRow
                          ? "bg-red-100 text-red-700"
                          : soon
                            ? "bg-amber-100 text-amber-900"
                            : "bg-ink/10 text-ink-soft"
                      }`}
                    >
                      {b.daysLeft === null
                        ? "—"
                        : expiredRow
                          ? `expired ${Math.abs(b.daysLeft)}d ago`
                          : b.daysLeft === 0
                            ? "expires today"
                            : `${b.daysLeft}d left`}
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => writeOff(b)}
                      className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                    >
                      Write off
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="text-xs text-ink-soft">
        Writing off a lot records it in Wastage at its cost and removes it from stock.
      </p>
    </div>
  );
}
