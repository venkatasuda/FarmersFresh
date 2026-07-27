"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatQty, formatRupees } from "@/lib/format";
import {
  WASTAGE_REASONS,
  logWastage,
  type WastageRow,
  type WastageSummary,
} from "./actions";

type ProductOpt = { id: string; name: string; unit: "kg" | "piece"; onHand: number };

const REASON_LABEL: Record<string, string> = Object.fromEntries(
  WASTAGE_REASONS.map((r) => [r.value, r.label])
);

export function WastageClient({
  summary,
  list,
  products,
  locationId,
}: {
  summary: WastageSummary;
  list: WastageRow[];
  products: ProductOpt[];
  locationId: string | null;
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Wastage</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Log spoilage, damage and losses. Every entry removes stock and is valued
          at its last cost, so you can see exactly where money is leaking.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs text-ink-soft">Lost to wastage (30 days)</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-red-600 tabular-nums">
            {formatRupees(summary.totalValue)}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {summary.totalEvents} event{summary.totalEvents === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs text-ink-soft">By reason</p>
          {summary.byReason.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Nothing logged yet.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {summary.byReason.map((r) => (
                <li key={r.reason} className="flex justify-between text-sm">
                  <span className="text-ink-soft">{REASON_LABEL[r.reason] ?? r.reason}</span>
                  <span className="tabular-nums text-ink">{formatRupees(r.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!locationId ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No dispatch store is set, so wastage can&apos;t be recorded against stock.
        </div>
      ) : (
        <LogForm
          products={products}
          locationId={locationId}
          onSaved={() => router.refresh()}
        />
      )}

      {summary.byProduct.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-3 text-sm font-medium text-ink">
            Most wasted (30 days)
          </h2>
          <ul className="divide-y divide-line">
            {summary.byProduct.map((p) => (
              <li key={p.productName} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="text-ink">{p.productName}</span>
                <span className="flex items-center gap-4">
                  <span className="text-ink-soft tabular-nums">{formatQty(p.quantity, "kg")}</span>
                  <span className="w-20 text-right font-medium text-red-600 tabular-nums">
                    {formatRupees(p.value)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <h2 className="border-b border-line px-5 py-3 text-sm font-medium text-ink">
          Recent entries
        </h2>
        {list.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-soft">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-4 px-5 py-2.5 text-sm">
                <div>
                  <span className="font-medium text-ink">{w.productName}</span>
                  <span className="ml-2 text-ink-soft">{REASON_LABEL[w.reason] ?? w.reason}</span>
                  {w.note ? <span className="ml-2 text-xs text-ink-soft">— {w.note}</span> : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-red-600 tabular-nums">
                    −{formatQty(w.quantity, "kg")}
                  </span>
                  <span className="w-20 text-right text-xs text-ink-soft tabular-nums">
                    {formatRupees(w.value)}
                  </span>
                  <span className="w-24 shrink-0 text-right text-xs text-ink-soft">
                    {new Date(w.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LogForm({
  products,
  locationId,
  onSaved,
}: {
  products: ProductOpt[];
  locationId: string;
  onSaved: () => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState(WASTAGE_REASONS[0].value);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const selected = products.find((p) => p.id === productId);

  function submit() {
    setError(null);
    setSaved(false);
    const q = Number.parseFloat(qty);
    if (!Number.isFinite(q) || q <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }
    startTransition(async () => {
      const r = await logWastage({ locationId, productId, quantity: q, reason, note });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setQty("");
      setNote("");
      setSaved(true);
      onSaved();
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink">Log wastage</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-ink-soft">Product</span>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {selected ? (
            <span className="mt-1 block text-xs text-ink-soft">
              On hand: {formatQty(selected.onHand, "kg")}
            </span>
          ) : null}
        </label>
        <label className="block">
          <span className="text-xs text-ink-soft">Quantity</span>
          <input
            type="number"
            min="0"
            step="0.5"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums"
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink-soft">Reason</span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            {WASTAGE_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-ink-soft">Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Logging…" : "Log wastage"}
        </button>
        {saved ? <span className="text-sm text-brand-700">Logged ✓</span> : null}
      </div>
    </div>
  );
}
