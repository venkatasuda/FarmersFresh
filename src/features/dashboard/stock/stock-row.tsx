"use client";

import { useRef, useState, useTransition } from "react";
import { countStock, recordStock } from "./actions";
import { formatQty } from "@/lib/format";
import { LOW_STOCK_KG, STOCK_REASONS, type StockLine } from "@/lib/types";

export function StockRow({
  line,
  locationId,
}: {
  line: StockLine;
  locationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState(STOCK_REASONS[0].value);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const request = useRef({ key: "", id: "" });
  const counting = reason === "count";

  const spec = STOCK_REASONS.find((r) => r.value === reason);
  const low = line.onHand > 0 && line.onHand < LOW_STOCK_KG;
  const out = line.onHand <= 0;

  function submit() {
    setError(null);
    const value = amount.trim() ? Number(amount) : NaN;
    const key = JSON.stringify([locationId,line.productId,value,line.onHand,note]);
    if (request.current.key !== key) request.current = { key, id: crypto.randomUUID() };

    startTransition(async () => {
      let r;
      try {
        r = counting
          ? await countStock(request.current.id, locationId, line.productId, value, line.onHand, note)
          : await recordStock(locationId, line.productId, value, reason, note);
      } catch { setError("Could not save. Please retry."); return; }
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setAmount("");
      setNote("");
      setOpen(false);
    });
  }

  return (
    <li className="px-5 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`size-2 shrink-0 rounded-full ${
              out ? "bg-red-500" : low ? "bg-amber-500" : "bg-brand-500"
            }`}
            aria-hidden
          />
          <div>
            <p className="font-medium text-ink">
              {line.name}
              {!line.isPublished ? (
                <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-ink-soft">
                  not on shop
                </span>
              ) : null}
            </p>
            <p className="text-xs text-ink-soft">
              {out
                ? "Out of stock at this store"
                : low
                  ? "Running low"
                  : "In stock"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`text-lg font-semibold tabular-nums ${
              out ? "text-red-600" : low ? "text-amber-600" : "text-ink"
            }`}
          >
            {formatQty(line.onHand, line.unit)}
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            {open ? "Close" : "Adjust"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-3 rounded-xl bg-canvas p-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1 basis-40">
              <span className="block text-xs font-medium text-ink-soft">
                Reason
              </span>
              <select
                disabled={pending}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              >
                {STOCK_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
                <option value="count">Count available stock</option>
              </select>
            </label>

            <label className="basis-28">
              <span className="block text-xs font-medium text-ink-soft">
                {counting ? "Counted available stock" : "Amount"} ({line.unit})
              </span>
              <input
                type="number"
                min="0"
                step={line.unit === "piece" ? "1" : "0.001"}
                disabled={pending}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              />
            </label>

            <label className="flex-1 basis-40">
              <span className="block text-xs font-medium text-ink-soft">
                {counting ? "Count reason (required)" : "Note (optional)"}
              </span>
              <input
                type="text"
                maxLength={500}
                disabled={pending}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              />
            </label>

            <button
              type="button"
              disabled={pending || !amount}
              onClick={submit}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                spec?.sign === -1
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-brand-600 hover:bg-brand-700"
              }`}
            >
              {pending
                ? "Saving…"
                : counting ? "Save count"
                : spec?.sign === -1
                  ? `Remove ${amount || "0"} ${line.unit}`
                  : `Add ${amount || "0"} ${line.unit}`}
            </button>
          </div>

          {error ? (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <p className="mt-2 text-xs text-ink-soft">
            {counting ? "Count sellable stock only; exclude stock already reserved for orders. If stock changed, refresh this page and count again. " : ""}
            Every change is written to the ledger with your name on it. There is
            no undo — a mistake is fixed by recording a correction.
          </p>
        </div>
      ) : null}
    </li>
  );
}
