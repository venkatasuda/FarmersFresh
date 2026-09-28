"use client";

import { useState, useTransition } from "react";
import { formatQty, formatRupees } from "@/lib/format";
import { getFinancials, type Financials } from "./actions";

const PERIODS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

const PAY_LABEL: Record<string, string> = {
  cod: "Cash on delivery",
  upi: "UPI",
  card: "Card",
  unknown: "Other",
};

export function FinancialsClient({
  initial,
  initialDays,
}: {
  initial: Financials;
  initialDays: number;
}) {
  const [days, setDays] = useState(initialDays);
  const [data, setData] = useState(initial);
  const [pending, startTransition] = useTransition();

  function pick(d: number) {
    setDays(d);
    startTransition(async () => {
      setData(await getFinancials(d));
    });
  }

  const { overview, margins, payments, alerts } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Financials</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Revenue, cost of goods and gross margin. Cost uses each product&apos;s
            last purchase cost, so it sharpens as you receive more orders.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => pick(p.days)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                days === p.days ? "bg-brand-600 text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-3 sm:grid-cols-4 ${pending ? "opacity-60" : ""}`}>
        <Kpi label="Revenue" value={formatRupees(overview.revenue)} />
        <Kpi label="Est. cost of goods" value={formatRupees(overview.cogs)} />
        <Kpi label="Gross profit" value={formatRupees(overview.grossProfit)} accent />
        <Kpi label="Gross margin" value={`${overview.marginPct}%`} accent />
      </div>

      {overview.costedPct < 100 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Cost is recorded for {overview.costedPct}% of revenue. Receive purchase
          orders to capture costs — margins below are only accurate for products
          that have a recorded cost.
        </div>
      ) : null}

      {alerts.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-red-200 bg-surface">
          <h2 className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm font-medium text-red-800">
            Thin or below-cost pricing — {alerts.length} product{alerts.length === 1 ? "" : "s"}
          </h2>
          <ul className="divide-y divide-line">
            {alerts.map((a) => (
              <li key={a.productName} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="text-ink">{a.productName}</span>
                <span className="flex items-center gap-4">
                  <span className="text-xs text-ink-soft">
                    sells {formatRupees(a.salePrice)} · cost{" "}
                    {a.lastCost === null ? "—" : formatRupees(a.lastCost)}
                  </span>
                  <span
                    className={`w-14 text-right font-medium tabular-nums ${
                      a.marginPct <= 0 ? "text-red-600" : "text-amber-700"
                    }`}
                  >
                    {a.marginPct}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border border-line bg-surface lg:col-span-2">
          <h2 className="border-b border-line px-5 py-3 text-sm font-medium text-ink">
            Margin by product
          </h2>
          {margins.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-soft">
              No sales in this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-soft">
                    <th className="px-5 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 text-right font-medium">Sold</th>
                    <th className="px-3 py-2 text-right font-medium">Revenue</th>
                    <th className="px-3 py-2 text-right font-medium">Profit</th>
                    <th className="px-5 py-2 text-right font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {margins.map((m) => (
                    <tr key={m.productName} className="border-b border-line/60">
                      <td className="px-5 py-2 text-ink">{m.productName}</td>
                      <td className="px-3 py-2 text-right text-ink-soft tabular-nums">
                        {formatQty(m.units, "kg")}
                      </td>
                      <td className="px-3 py-2 text-right text-ink tabular-nums">
                        {formatRupees(m.revenue)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink">
                        {m.lastCost === null ? "—" : formatRupees(m.profit)}
                      </td>
                      <td
                        className={`px-5 py-2 text-right font-medium tabular-nums ${
                          m.lastCost === null
                            ? "text-ink-soft"
                            : m.marginPct <= 0
                              ? "text-red-600"
                              : "text-brand-700"
                        }`}
                      >
                        {m.lastCost === null ? "—" : `${m.marginPct}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="h-fit overflow-hidden rounded-2xl border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-3 text-sm font-medium text-ink">
            Money collected
          </h2>
          {payments.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-soft">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {payments.map((p) => (
                <li key={p.paymentMethod} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-ink">
                    {PAY_LABEL[p.paymentMethod] ?? p.paymentMethod}
                    <span className="ml-2 text-xs text-ink-soft">
                      {p.orders} order{p.orders === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="font-medium text-ink tabular-nums">
                    {formatRupees(p.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-ink-soft">
        A dash (—) means no purchase cost has been recorded for that product yet,
        so its profit can&apos;t be calculated. Receive a purchase order to fix it.
      </p>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs text-ink-soft">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${
          accent ? "text-brand-700" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
