"use client";

import { useMemo, useState, useTransition } from "react";
import { formatQty, formatRupees } from "@/lib/format";
import type { ForecastResult, ReorderSuggestion } from "@/lib/forecast";
import { createDraftFromSuggestions, getSuggestions } from "./actions";

type Params = { lookback: number; horizon: number; lead: number };

export function ReorderClient({
  initial,
  defaults,
  suppliers,
}: {
  initial: ForecastResult;
  defaults: Params;
  suppliers: { id: string; name: string }[];
}) {
  const [result, setResult] = useState(initial);
  const [params, setParams] = useState<Params>(defaults);
  const [qtys, setQtys] = useState<Record<string, string>>(() => seedQtys(initial.suggestions));
  const [checked, setChecked] = useState<Set<string>>(() => seedChecked(initial.suggestions));
  const [supplierId, setSupplierId] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function recalc(next: Params) {
    setParams(next);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const r = await getSuggestions(next);
      setResult(r);
      setQtys(seedQtys(r.suggestions));
      setChecked(seedChecked(r.suggestions));
    });
  }

  const toOrder = result.suggestions.filter((s) => checked.has(s.productId));
  const orderValue = useMemo(
    () =>
      toOrder.reduce(
        (sum, s) => sum + (Number.parseFloat(qtys[s.productId] ?? "0") || 0) * (s.lastCost ?? 0),
        0
      ),
    [toOrder, qtys]
  );

  function createPO() {
    setMessage(null);
    setError(null);
    const items = toOrder
      .map((s) => ({
        productId: s.productId,
        qty: Number.parseFloat(qtys[s.productId] ?? "0") || 0,
        unitCost: s.lastCost ?? 0,
      }))
      .filter((i) => i.qty > 0);
    if (items.length === 0) {
      setError("Tick at least one item with a quantity.");
      return;
    }
    startTransition(async () => {
      const r = await createDraftFromSuggestions({ supplierId: supplierId || null, items });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setMessage(`Draft ${r.poNumber} created — review and receive it in Purchasing.`);
    });
  }

  const anySuggested = result.suggestions.some((s) => s.suggestedQty > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Reorder</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            How much to buy so you don&apos;t run out or over-stock. Demand is the
            trailing daily average; we project it over the cover window and subtract
            what&apos;s on hand and already on order.
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            result.source === "custom"
              ? "bg-brand-100 text-brand-800"
              : "bg-ink/10 text-ink-soft"
          }`}
          title="Set FORECAST_PROVIDER=custom to use your own model"
        >
          {result.source === "custom" ? "Your model" : "Baseline forecast"}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4">
        <NumControl
          label="Cover days"
          value={params.horizon}
          onChange={(v) => recalc({ ...params, horizon: v })}
          hint="Days of demand to stock"
        />
        <NumControl
          label="Lead time"
          value={params.lead}
          onChange={(v) => recalc({ ...params, lead: v })}
          hint="Days for delivery"
        />
        <NumControl
          label="History window"
          value={params.lookback}
          onChange={(v) => recalc({ ...params, lookback: v })}
          hint="Days of demand used"
        />
        {pending ? <span className="text-sm text-ink-soft">Recalculating…</span> : null}
      </div>

      {result.suggestions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-ink-soft">
          No sales history yet in this window, so there&apos;s nothing to forecast.
        </p>
      ) : (
        <>
          {!anySuggested ? (
            <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
              You&apos;re well stocked — nothing needs reordering for this cover window.
            </div>
          ) : null}

          <section className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-soft">
                    <th className="px-4 py-2 font-medium"> </th>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 text-right font-medium">Sells/day</th>
                    <th className="px-3 py-2 text-right font-medium">On hand</th>
                    <th className="px-3 py-2 text-right font-medium">Covers</th>
                    <th className="px-4 py-2 text-right font-medium">Order</th>
                  </tr>
                </thead>
                <tbody>
                  {result.suggestions.map((s) => (
                    <Row
                      key={s.productId}
                      s={s}
                      qty={qtys[s.productId] ?? ""}
                      checked={checked.has(s.productId)}
                      onQty={(v) => setQtys((q) => ({ ...q, [s.productId]: v }))}
                      onToggle={() =>
                        setChecked((c) => {
                          const n = new Set(c);
                          if (n.has(s.productId)) n.delete(s.productId);
                          else n.add(s.productId);
                          return n;
                        })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-ink-soft">
                Supplier
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="ml-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                >
                  <option value="">No supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-sm text-ink-soft">
                Est. cost{" "}
                <span className="font-medium text-ink tabular-nums">
                  {formatRupees(orderValue)}
                </span>
              </span>
            </div>
            <button
              type="button"
              disabled={pending || toOrder.length === 0}
              onClick={createPO}
              className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Create draft purchase order
            </button>
          </div>
        </>
      )}

      {message ? (
        <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {message}
        </p>
      ) : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}

      <p className="text-xs text-ink-soft">
        Costs use each product&apos;s last purchase price. A draft order lands in
        Purchasing, where you confirm and receive it.
      </p>
    </div>
  );
}

function Row({
  s,
  qty,
  checked,
  onQty,
  onToggle,
}: {
  s: ReorderSuggestion;
  qty: string;
  checked: boolean;
  onQty: (v: string) => void;
  onToggle: () => void;
}) {
  const urgent = s.coverDays !== null && s.coverDays <= 3;
  const low = s.coverDays !== null && s.coverDays > 3 && s.coverDays <= 7;
  return (
    <tr className="border-b border-line/60">
      <td className="px-4 py-2">
        <input type="checkbox" checked={checked} onChange={onToggle} className="size-4 accent-brand-600" />
      </td>
      <td className="px-3 py-2 text-ink">{s.productName}</td>
      <td className="px-3 py-2 text-right text-ink-soft tabular-nums">{s.avgDaily}</td>
      <td className="px-3 py-2 text-right text-ink-soft tabular-nums">
        {formatQty(s.onHand, "kg")}
      </td>
      <td
        className={`px-3 py-2 text-right font-medium tabular-nums ${
          urgent ? "text-red-600" : low ? "text-amber-700" : "text-ink-soft"
        }`}
      >
        {s.coverDays === null ? "—" : `${s.coverDays}d`}
      </td>
      <td className="px-4 py-2 text-right">
        <input
          type="number"
          min="0"
          step="0.5"
          value={qty}
          onChange={(e) => onQty(e.target.value)}
          className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-right text-sm tabular-nums"
        />
      </td>
    </tr>
  );
}

function NumControl({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-ink-soft">{label}</span>
      <input
        type="number"
        min="1"
        step="1"
        defaultValue={value}
        onBlur={(e) => {
          const v = Math.max(1, Number.parseInt(e.target.value) || value);
          if (v !== value) onChange(v);
        }}
        className="mt-1 block w-24 rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums"
      />
      {hint ? <span className="mt-0.5 block text-xs text-ink-soft">{hint}</span> : null}
    </label>
  );
}

function seedQtys(list: ReorderSuggestion[]): Record<string, string> {
  return Object.fromEntries(list.map((s) => [s.productId, String(s.suggestedQty)]));
}
function seedChecked(list: ReorderSuggestion[]): Set<string> {
  return new Set(list.filter((s) => s.suggestedQty > 0).map((s) => s.productId));
}
