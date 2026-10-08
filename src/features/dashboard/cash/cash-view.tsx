"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatRupees } from "@/lib/format";
import type { CashSummary, CashShifts } from "@/lib/contracts/staff-cash";
import { collectCod, closeCashDay, refundReturnCash, openCashShift, closeCashShift } from "./actions";

export function CashView({ locations, location, date, today, summary, shifts, canClose, canCollect }: {
  locations: { id: string; name: string }[]; location: string; date: string; today: string;
  summary: CashSummary; shifts: CashShifts | null; canClose: boolean; canCollect: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [shiftRequest, setShiftRequest] = useState(() => crypto.randomUUID());
  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setMessage(null);
    start(async () => {
      try {
        const result = await action();
        setMessage(result.ok ? "Saved." : result.message ?? "Could not save. Please retry.");
        if (result.ok) { setShiftRequest(crypto.randomUUID()); router.refresh(); }
      } catch { setMessage("Could not save. Please retry."); }
    });
  }
  return <div className="space-y-6">
    <h1 className="text-2xl font-semibold text-ink">Cash reconciliation</h1>
    <form className="flex flex-wrap items-end gap-3">
      <label className="text-sm text-ink-soft">Store
        <select name="location" defaultValue={location} className="ml-2 rounded-lg border border-line bg-surface p-2 text-ink">
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      <label className="text-sm text-ink-soft">Business date (India)
        <input name="date" type="date" required defaultValue={date} max={today} className="ml-2 rounded-lg border border-line bg-surface p-2 text-ink" />
      </label>
      <button className="rounded-lg bg-brand-600 px-4 py-2 text-white">View cash</button>
    </form>
    {message ? <p role="status" className="text-sm text-ink">{message}</p> : null}
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="font-semibold text-ink">Receipts for {date}</h2>
      <p className="mt-2 text-sm text-ink-soft">COD collected: {formatRupees(summary.cod)} · Counter cash payments: {formatRupees(summary.pos)}</p>
      <p className="mt-2 font-semibold text-brand-700">Expected cash receipts: {formatRupees(summary.expected)}</p>
      <p className="mt-2 text-sm text-ink-soft">Cash refunds paid out: {formatRupees(summary.refunds)}. Receipt closing above is gross; till closing below subtracts refunds.</p>
      <p className="mt-2 text-xs text-ink-soft">Count only receipts for this day. Exclude opening float, bank deposits and transfers. Wallet points and card/UPI payments are excluded.</p>
    </section>
    {canClose && shifts ? <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="font-semibold text-ink">Store till shift</h2>
      <p className="mt-2 text-xs text-ink-soft">One shared till per store. Count the opening float and all cash held. No bank deposits, cash transfers or top-ups during a shift; close the shift before moving cash.</p>
      {shifts.active ? <form className="mt-3 space-y-3" onSubmit={event => {
        event.preventDefault(); if (pending) return;
        const form = new FormData(event.currentTarget), shift = shifts.active!;
        if (confirm("Close this till shift permanently? Confirm all cash has been counted.")) run(() => closeCashShift(shift.id, Number(shift.expected), Number(form.get("counted")), String(form.get("note") ?? "")));
      }}>
        <p className="text-sm text-ink">Opening {formatRupees(shifts.active.opening)} + receipts {formatRupees(shifts.active.receipts)} − refunds {formatRupees(shifts.active.refunds)} = expected {formatRupees(shifts.active.expected)}</p>
        <label className="block text-sm text-ink-soft">Counted till cash (₹)<input name="counted" type="number" required min="0" max="100000000" step="0.01" disabled={pending} className="ml-2 rounded-lg border border-line bg-surface p-2 text-ink" /></label>
        <label className="block text-sm text-ink-soft">Till shortage or surplus explanation<input name="note" maxLength={500} disabled={pending} className="mt-1 block w-full rounded-lg border border-line bg-surface p-2 text-ink" /></label>
        <button disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-white disabled:opacity-50">Close till shift</button>
      </form> : <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault(); if (pending) return;
        const form = new FormData(event.currentTarget);
        if (confirm("Open a till shift with this counted opening cash?")) run(() => openCashShift(shiftRequest, location, Number(form.get("opening"))));
      }}>
        <label className="text-sm text-ink-soft">Opening till cash (₹)<input name="opening" type="number" required min="0" max="100000000" step="0.01" disabled={pending} className="ml-2 rounded-lg border border-line bg-surface p-2 text-ink" /></label>
        <button disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-white disabled:opacity-50">Open till shift</button>
      </form>}
      {shifts.recent.length ? <ul className="mt-4 divide-y divide-line">{shifts.recent.map(s => <li key={s.id} className="py-2 text-sm text-ink">Closed {new Date(s.closed_at!).toLocaleString("en-IN")} · counted {formatRupees(s.counted!)} · difference {formatRupees(s.difference!)}{s.note ? ` · ${s.note}` : ""}</li>)}</ul> : null}
    </section> : null}
    {summary.refund_requests.length ? <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="font-semibold text-ink">COD return cash refunds</h2>
      <p className="mt-1 text-xs text-ink-soft">Record only cash physically paid back today. A cash refund approves the return and prevents wallet compensation for that order.</p>
      <ul className="mt-3 divide-y divide-line">{summary.refund_requests.map(r => <li key={r.id} className="py-3">
        <form className="space-y-2" onSubmit={event => {
          event.preventDefault(); if (pending) return;
          const form = new FormData(event.currentTarget), amount = Number(form.get("amount"));
          if (confirm(`Confirm ${formatRupees(amount)} cash was paid back for ${r.order_number}?`)) run(() => refundReturnCash(r.id, amount, String(form.get("reason") ?? "")));
        }}>
          <p className="text-sm text-ink">{r.order_number} · available cash refund {formatRupees(r.collected)}</p>
          <label className="block text-sm text-ink-soft">Cash refund (₹)<input name="amount" type="number" required min="0.01" max={r.collected} step="0.01" disabled={pending} className="ml-2 rounded-lg border border-line bg-surface p-2 text-ink" /></label>
          <label className="block text-sm text-ink-soft">Refund reason<input name="reason" required maxLength={500} disabled={pending} className="mt-1 block w-full rounded-lg border border-line bg-surface p-2 text-ink" /></label>
          <button disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-white disabled:opacity-50">Record cash refund</button>
        </form>
      </li>)}</ul>
    </section> : null}
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="font-semibold text-ink">Delivered COD awaiting collection ({summary.outstanding_count})</h2>
      <p className="mt-1 text-xs text-ink-soft">All outstanding delivery dates; collection is recorded for today. Showing the oldest 100.</p>
      {summary.outstanding.length ? <ul className="mt-3 divide-y divide-line">
        {summary.outstanding.map(order => <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-ink">
          <span>{order.order_number} · {formatRupees(order.total)}</span>
          {canCollect ? <button disabled={pending} className="rounded-lg bg-brand-600 px-3 py-2 text-white disabled:opacity-50" onClick={() => {
            if (confirm(`Confirm the full ${formatRupees(order.total)} cash payment has been collected for ${order.order_number}?`)) run(() => collectCod(order.id, Number(order.total)));
          }}>Record cash collected</button> : null}
        </li>)}
      </ul> : <p className="mt-3 text-sm text-ink-soft">No outstanding COD collections.</p>}
    </section>
    {canClose ? <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="font-semibold text-ink">Daily cash closing</h2>
      {summary.closing ? <div className="mt-3 space-y-1 text-sm text-ink">
        <p>Closed · Counted {formatRupees(summary.closing.counted)} · Difference {formatRupees(summary.closing.difference)}</p>
        {summary.closing.note ? <p>{summary.closing.note}</p> : null}
      </div> : date >= today ? <p className="mt-3 text-sm text-ink-soft">Select a completed business day to close it. Today’s receipts are still open.</p> : <form className="mt-3 space-y-3" onSubmit={event => {
        event.preventDefault(); if (pending) return;
        const form = new FormData(event.currentTarget);
        if (confirm("Close this day permanently using the counted cash receipts?")) run(() => closeCashDay(location, date, Number(summary.expected), Number(form.get("counted")), String(form.get("note") ?? "")));
      }}>
        <label className="block text-sm text-ink-soft">Counted cash receipts (₹)
          <input name="counted" type="number" required min="0" max="100000000" step="0.01" disabled={pending} className="ml-2 rounded-lg border border-line bg-surface p-2 text-ink" />
        </label>
        <label className="block text-sm text-ink-soft">Shortage or surplus explanation
          <input name="note" maxLength={500} disabled={pending} className="mt-1 block w-full rounded-lg border border-line bg-surface p-2 text-ink" />
        </label>
        <button disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-white disabled:opacity-50">Close cash day</button>
      </form>}
    </section> : null}
  </div>;
}
