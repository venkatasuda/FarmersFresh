"use client";

import { useState, useTransition } from "react";
import { formatQty } from "@/lib/format";
import type { ReorderSuggestion } from "@/lib/forecast";
import { recordProduction } from "./actions";

export function ProductionClient({ initial }: { initial: ReorderSuggestion[] }) {
  const [qtys, setQtys] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.map((s) => [s.productId, s.suggestedQty > 0 ? String(s.suggestedQty) : ""]))
  );
  const [expiries, setExpiries] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setMsg(null);
    setError(null);
    const items = initial
      .map((s) => ({
        productId: s.productId,
        qty: Number.parseFloat(qtys[s.productId] ?? "0") || 0,
        expiry: expiries[s.productId] || undefined,
      }))
      .filter((i) => i.qty > 0);
    if (items.length === 0) {
      setError("Enter at least one quantity to produce.");
      return;
    }
    startTransition(async () => {
      const r = await recordProduction(items);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setMsg(`Recorded ${r.count} production ${r.count === 1 ? "batch" : "batches"} into stock.`);
      setQtys((q) => Object.fromEntries(Object.keys(q).map((k) => [k, ""])));
      setExpiries({});
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Production</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Today&apos;s cut sheet. Suggested = one day of forecast demand minus what&apos;s
          on hand. Enter what you actually cut/prepared and it goes into stock as a dated
          batch (so it rotates and expires correctly).
        </p>
      </div>

      {initial.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-ink-soft">
          No demand history yet, so nothing to plan.
        </p>
      ) : (
        <>
          <section className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-soft">
                    <th className="px-4 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 text-right font-medium">Sells/day</th>
                    <th className="px-3 py-2 text-right font-medium">On hand</th>
                    <th className="px-3 py-2 text-right font-medium">Suggested</th>
                    <th className="px-3 py-2 text-right font-medium">Produce</th>
                    <th className="px-4 py-2 text-right font-medium">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {initial.map((s) => (
                    <tr key={s.productId} className="border-b border-line/60">
                      <td className="px-4 py-2 text-ink">{s.productName}</td>
                      <td className="px-3 py-2 text-right text-ink-soft tabular-nums">{s.avgDaily}</td>
                      <td className="px-3 py-2 text-right text-ink-soft tabular-nums">
                        {formatQty(s.onHand, "kg")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink">
                        {s.suggestedQty > 0 ? s.suggestedQty : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={qtys[s.productId] ?? ""}
                          onChange={(e) => setQtys((q) => ({ ...q, [s.productId]: e.target.value }))}
                          className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-right text-sm tabular-nums"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="date"
                          value={expiries[s.productId] ?? ""}
                          onChange={(e) => setExpiries((x) => ({ ...x, [s.productId]: e.target.value }))}
                          className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          {msg ? <p className="text-sm text-brand-700">{msg}</p> : null}

          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? "Recording…" : "Record production"}
          </button>
        </>
      )}
    </div>
  );
}
