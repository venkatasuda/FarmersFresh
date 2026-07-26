"use client";

import { useState, useTransition } from "react";
import { approveReturn, rejectReturn, type ReturnRow } from "./actions";

const STATUS_STYLES: Record<string, string> = {
  requested: "bg-amber-100 text-amber-900",
  approved: "bg-brand-100 text-brand-800",
  rejected: "bg-line/60 text-ink-soft",
};

export function ReturnsList({ rows }: { rows: ReturnRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
        <h2 className="text-lg font-medium text-ink">Nothing to review</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Customer issues on delivered orders show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <ReturnCard key={r.id} row={r} />
      ))}
    </ul>
  );
}

function ReturnCard({ row }: { row: ReturnRow }) {
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function approve() {
    setError(null);
    startTransition(async () => {
      const r = await approveReturn(row.id, Math.max(0, Number.parseFloat(points || "0")), note);
      if (!r.ok) setError(r.message ?? "Couldn't approve.");
    });
  }
  function reject() {
    setError(null);
    startTransition(async () => {
      const r = await rejectReturn(row.id, note);
      if (!r.ok) setError(r.message ?? "Couldn't reject.");
    });
  }

  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">{row.orderNumber}</p>
          <p className="text-xs text-ink-soft">
            {new Date(row.createdAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            STATUS_STYLES[row.status] ?? ""
          }`}
        >
          {row.status}
        </span>
      </div>

      <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-sm text-ink">{row.reason}</p>

      {row.status === "requested" ? (
        <div className="mt-3 space-y-2">
          {row.hasAccount ? (
            <div className="flex items-center gap-2">
              <label className="text-xs text-ink-soft">Refund points</label>
              <input
                type="number"
                min="0"
                step="1"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="0"
                className="w-24 rounded-md border border-line bg-surface px-2 py-1 text-sm tabular-nums"
              />
              <span className="text-xs text-ink-soft">= ₹{Math.max(0, Math.floor(Number.parseFloat(points || "0")) || 0)}</span>
            </div>
          ) : (
            <p className="text-xs text-ink-soft">
              No account on this order — refund cash at the counter; points can&apos;t be
              credited.
            </p>
          )}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm"
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={approve}
              className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {row.hasAccount && Math.floor(Number.parseFloat(points || "0")) > 0
                ? "Approve & refund"
                : "Approve"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={reject}
              className="rounded-lg border border-line px-3.5 py-1.5 text-sm text-ink-soft hover:border-red-300 hover:text-red-700 disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-ink-soft">
          {row.status === "approved"
            ? row.refundPoints > 0
              ? `Approved — ${Math.floor(row.refundPoints)} points refunded.`
              : "Approved."
            : "Rejected."}
          {row.staffNote ? ` · ${row.staffNote}` : ""}
        </p>
      )}
    </li>
  );
}
